import * as dva from 'dva-core';
import regenerator from 'regenerator-runtime';
import _set from 'lodash/set';
import _get from 'lodash/get';

const connect = (mapStateToProps) => {
    const app = getApp()
    const state = app._store.getState();
    const watchMap = mapStateToProps(state);

    return (opts) => {
        const onLoad = opts.onLoad;
        const onShow = opts.onShow;


        opts.onLoad = function (options) {
            const page = this;
            page._watchMap = Object.keys(watchMap);
            page._query = options;
           
            page._updateData = function (newData) {

                page.setData(newData);
            };

            onLoad(options, app._store.dispatch)
        }

        opts.onShow = function () {
            global._routing_ = false;
            const app = getApp()._dva_app_;
            app._history._handler();
            onShow()
        }

        return {
            ...opts,
            data: {
                ...watchMap
            },
            dispatch: app._store.dispatch
        }
    }
}



const history = {
    _listenHooks: [],
    _oldPages: [],
    _handler: () => {
        const pages = getCurrentPages();
        const oldPages = history._oldPages;

        if (pages.length > 0) {
            const isBack = pages.length + 1 == oldPages.length; //页面返回	页面不断出栈，直到目标返回页，新页面入栈
            // console.log(isBack)
            history._oldPages = pages;
            const currentPage = {route : pages[pages.length - 1].route , _query : pages[pages.length - 1]._query}            

            if(currentPage.route.indexOf('/') != 0){
                currentPage.route = '/' + currentPage.route
            }

            const app = getApp();
            app._store.dispatch({
                type: '@@route/save',
                payload:{
                    pathname: currentPage.route,
                    query: currentPage._query,
                    isBack
                }
            })

            history._listenHooks.forEach((listen) => {
                
                listen({
                    pathname: currentPage.route,
                    query: currentPage._query,
                    isBack
                })
    
    
            })
        }
        
    },

    listen: (callback) => {
        history._listenHooks.push(callback)
    },
}

const creatApp = (opts) => {
    const app = dva.create({
        onStateChange: (state) => {
            // 同步数据到每一个页面
            //console.log(state)
            const pages = getCurrentPages();
            pages.forEach((page) => {
                if (page._watchMap && page._updateData) {
                    page._watchMap.forEach((key) => {
                        if (state[key]) {
                            const upData = {};
                            upData[key] = state[key];
                            page._updateData(upData)
                        }

                    })
                }
            })
        }
    });

    app._history = history;

    if (opts.models) {
        opts.models.forEach((model) => {
            app.model(model)
        })
    }

    // 初始化记录路由数据的模块
    app.model({
        namespace: '@@route',
        state: {
            pathname: null,
            query: {},
            isBack: false
        },
        reducers: {
            save(state, { payload }) {
                return { ...state, ...payload };
            },
        },

        effects: {}
    })
    app.start()

    opts._store = app._store;
    opts._dva_app_ = app;

    return opts;
}

const request = (opts) => {

    return new Promise((resolve, reject) => {
        opts.success = ({ data, statusCode, header }) => {
            resolve({ data, statusCode, header })
        }

        opts.fail = (error) => {
            reject(error)
        }

        wx.request(opts)
    })
}


const getNodeAttr = (e, name) => {
    // console.log(e)
    if (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset[name]) {
        return e.currentTarget.dataset[name];
    }
    return undefined;
}
global._routing_ = false
const routerRedux = ({ pathname, query }) => {
    // console.log(global._routing_)
    if(global._routing_) return { type: '@@route/save', payload: {}};
    global._routing_ = true;
    let queryStr = '';
    Object.keys(query).forEach((key) => {
        queryStr += key + '=' + query[key];
    });

    wx.navigateTo({
        url: pathname + '?' + queryStr
    })

    return {
        type: '@@route/save',
        payload:{
            pathname,
            query,
            isBack: false
        }
    };
}
/**
 * 这段代码复制来自
 * https://github.com/maichong/labrador/blob/ed416658f1ab5395e81a847b6255d47857a39410/index.js#L55
 * 
 * 主要作用是把微信的接口直接用Promise封装
 */

// 特别指定的wx对象中不进行Promise封装的方法
const noPromiseMethods = {
    clearStorage: 1,
    hideToast: 1,
    showNavigationBarLoading: 1,
    hideNavigationBarLoading: 1,
    drawCanvas: 1,
    canvasToTempFilePath: 1,
    hideKeyboard: 1,
};
const _wx = {};
Object.keys(wx).forEach((key) => {
    if (
        noPromiseMethods[key]                        // 特别指定的方法
        || /^(on|create|stop|pause|close)/.test(key) // 以on* create* stop* pause* close* 开头的方法
        || /\w+Sync$/.test(key)                      // 以Sync结尾的方法
    ) {
        // 不进行Promise封装
        _wx[key] = function () {
            if (__DEV__) {
                let res = wx[key].apply(wx, arguments);
                if (!res) {
                    res = {};
                }
                if (res && typeof res === 'object') {
                    res.then = () => {
                        console.warn('wx.' + key + ' is not a async function, you should not use await ');
                    };
                }
                return res;
            }
            return wx[key].apply(wx, arguments);
        };
        return;
    }

    // 其余方法自动Promise化
    _wx[key] = function (obj) {
        obj = obj || {};
        return new Promise((resolve, reject) => {
            obj.success = resolve;
            obj.fail = (res) => {
                if (res && res.errMsg) {
                    reject(new Error(res.errMsg));
                } else {
                    reject(res);
                }
            };
            wx[key](obj);
        });
    };
});
/**
 * 复制结束 (#^.^#)
 */
export {
    creatApp,
    regenerator,
    connect,
    request,
    getNodeAttr,
    routerRedux,
    _wx
}