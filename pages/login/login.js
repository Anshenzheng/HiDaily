const app = getApp()

Page({
  data: {
    isLoading: false
  },

  onLoad: function (options) {
    const redirectUrl = options.redirectUrl || '/pages/index/index'
    this.setData({ redirectUrl })
  },

  onGotUserInfo: function(e) {
    if (e.detail.userInfo) {
      this.setData({ isLoading: true })
      
      this.getOpenid().then(openid => {
        app.globalData.openid = openid
        app.globalData.userInfo = e.detail.userInfo
        app.globalData.isLoggedIn = true
        
        wx.setStorageSync('openid', openid)
        wx.setStorageSync('userInfo', e.detail.userInfo)
        
        this.saveUserToDb(e.detail.userInfo, openid)
      }).catch(err => {
        console.error('登录失败:', err)
        wx.showToast({
          title: '登录失败',
          icon: 'none'
        })
        this.setData({ isLoading: false })
      })
    } else {
      wx.showToast({
        title: '请授权登录',
        icon: 'none'
      })
    }
  },

  getOpenid: function() {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'login',
        success: res => {
          resolve(res.result.openid)
        },
        fail: err => {
          reject(err)
        }
      })
    })
  },

  saveUserToDb: function(userInfo, openid) {
    const db = wx.cloud.database()
    
    db.collection('users').where({
      _openid: openid
    }).get().then(res => {
      if (res.data.length === 0) {
        db.collection('users').add({
          data: {
            ...userInfo,
            createTime: db.serverDate(),
            lastLoginTime: db.serverDate()
          },
          success: () => {
            this.loginSuccess()
          },
          fail: (err) => {
            console.error('保存用户信息失败:', err)
            this.setData({ isLoading: false })
          }
        })
      } else {
        db.collection('users').doc(res.data[0]._id).update({
          data: {
            lastLoginTime: db.serverDate(),
            ...userInfo
          },
          success: () => {
            this.loginSuccess()
          },
          fail: (err) => {
            console.error('更新用户信息失败:', err)
            this.setData({ isLoading: false })
          }
        })
      }
    }).catch(err => {
      console.error('查询用户失败:', err)
      this.setData({ isLoading: false })
    })
  },

  loginSuccess: function() {
    this.setData({ isLoading: false })
    
    wx.showToast({
      title: '登录成功',
      icon: 'success'
    })
    
    setTimeout(() => {
      const redirectUrl = this.data.redirectUrl
      if (redirectUrl && redirectUrl !== '/pages/login/login') {
        wx.redirectTo({
          url: redirectUrl
        })
      } else {
        wx.switchTab({
          url: '/pages/index/index'
        })
      }
    }, 1000)
  }
})
