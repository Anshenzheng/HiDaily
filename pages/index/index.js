const app = getApp()

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    habits: [],
    todayCheckins: [],
    todayDate: '',
    todayWeekday: '',
    loading: true,
    stats: {
      totalHabits: 0,
      completedToday: 0,
      currentStreak: 0,
      longestStreak: 0
    }
  },

  onLoad: function () {
    this.initDate()
  },

  onShow: function () {
    this.checkLogin()
  },

  onPullDownRefresh: function () {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  initDate: function () {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const day = now.getDate()
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekday = weekdays[now.getDay()]

    this.setData({
      todayDate: `${year}年${month}月${day}日`,
      todayWeekday: weekday
    })
  },

  checkLogin: function () {
    if (app.globalData.isLoggedIn) {
      this.setData({
        isLoggedIn: true,
        userInfo: app.globalData.userInfo
      })
      this.loadData()
    } else {
      this.setData({
        isLoggedIn: false,
        loading: false
      })
    }
  },

  loadData: function () {
    return new Promise((resolve) => {
      this.setData({ loading: true })
      
      Promise.all([
        this.loadHabits(),
        this.loadTodayCheckins()
      ]).then(() => {
        this.calculateStats()
        this.setData({ loading: false })
        resolve()
      }).catch(() => {
        this.setData({ loading: false })
        resolve()
      })
    })
  },

  loadHabits: function () {
    return new Promise((resolve, reject) => {
      wx.cloud.callFunction({
        name: 'getHabits',
        data: { status: 'active' },
        success: (res) => {
          if (res.result.success) {
            this.setData({ habits: res.result.data })
            resolve()
          } else {
            reject(res.result.error)
          }
        },
        fail: (err) => {
          console.error('加载习惯失败:', err)
          reject(err)
        }
      })
    })
  },

  loadTodayCheckins: function () {
    return new Promise((resolve, reject) => {
      const today = this.formatDate(new Date())
      
      wx.cloud.callFunction({
        name: 'getCheckins',
        data: { date: today },
        success: (res) => {
          if (res.result.success) {
            this.setData({ todayCheckins: res.result.data })
            resolve()
          } else {
            reject(res.result.error)
          }
        },
        fail: (err) => {
          console.error('加载今日打卡记录失败:', err)
          reject(err)
        }
      })
    })
  },

  calculateStats: function () {
    const { habits, todayCheckins } = this.data
    
    const completedHabitIds = todayCheckins.map(c => c.habitId)
    const completedToday = habits.filter(h => completedHabitIds.includes(h._id)).length
    
    let totalCurrentStreak = 0
    let totalLongestStreak = 0
    
    const habitsWithCheckStatus = habits.map(habit => {
      totalCurrentStreak = Math.max(totalCurrentStreak, habit.currentStreak || 0)
      totalLongestStreak = Math.max(totalLongestStreak, habit.longestStreak || 0)
      
      return {
        ...habit,
        isCheckedToday: completedHabitIds.includes(habit._id)
      }
    })

    this.setData({
      habits: habitsWithCheckStatus,
      stats: {
        totalHabits: habits.length,
        completedToday: completedToday,
        currentStreak: totalCurrentStreak,
        longestStreak: totalLongestStreak
      }
    })
  },

  onCheckin: function (e) {
    const habitId = e.currentTarget.dataset.id
    const habitName = e.currentTarget.dataset.name
    const habitIcon = e.currentTarget.dataset.icon
    const isChecked = this.isHabitCheckedToday(habitId)

    if (isChecked) {
      wx.showToast({
        title: '今日已打卡',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认打卡',
      content: `确认完成「${habitIcon} ${habitName}」了吗？`,
      success: (res) => {
        if (res.confirm) {
          this.doCheckin(habitId)
        }
      }
    })
  },

  doCheckin: function (habitId) {
    wx.showLoading({ title: '打卡中...' })

    wx.cloud.callFunction({
      name: 'checkin',
      data: { habitId: habitId },
      success: (res) => {
        wx.hideLoading()
        
        if (res.result.success) {
          wx.showToast({
            title: '打卡成功！',
            icon: 'success'
          })
          
          const checkin = res.result.data
          const todayCheckins = [...this.data.todayCheckins, checkin]
          this.setData({ todayCheckins })
          this.calculateStats()
        } else {
          wx.showToast({
            title: res.result.error || '打卡失败',
            icon: 'none'
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('打卡失败:', err)
        wx.showToast({
          title: '打卡失败，请稍后重试',
          icon: 'none'
        })
      }
    })
  },

  isHabitCheckedToday: function (habitId) {
    return this.data.todayCheckins.some(c => c.habitId === habitId)
  },

  onEditHabit: function (e) {
    const habitId = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/create/create?edit=1&id=${habitId}`
    })
  },

  onAddHabit: function () {
    wx.switchTab({
      url: '/pages/create/create'
    })
  },

  onGoLogin: function () {
    wx.navigateTo({
      url: '/pages/login/login?redirectUrl=/pages/index/index'
    })
  },

  formatDate: function (date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
})
