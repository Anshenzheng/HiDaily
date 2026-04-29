const app = getApp()

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    habits: [],
    currentYear: 0,
    currentMonth: 0,
    calendarData: [],
    dailyStats: {},
    habitStats: [],
    loading: true,
    selectedDate: null,
    showSupplementModal: false,
    supplementDate: '',
    availableHabits: [],
    totalStats: {
      totalHabits: 0,
      totalCheckins: 0,
      maxCurrentStreak: 0,
      maxLongestStreak: 0
    }
  },

  onLoad: function () {
    const now = new Date()
    this.setData({
      currentYear: now.getFullYear(),
      currentMonth: now.getMonth() + 1
    })
  },

  onShow: function () {
    this.checkLogin()
  },

  onPullDownRefresh: function () {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
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
        this.loadMonthlyStats()
      ]).then(() => {
        this.calculateTotalStats()
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

  loadMonthlyStats: function () {
    return new Promise((resolve, reject) => {
      const { currentYear, currentMonth } = this.data
      
      wx.cloud.callFunction({
        name: 'getMonthlyStats',
        data: { 
          year: currentYear, 
          month: currentMonth 
        },
        success: (res) => {
          if (res.result.success) {
            const data = res.result.data
            this.setData({
              dailyStats: data.dailyStats,
              habitStats: data.habitStats
            })
            this.generateCalendarData(data)
            resolve()
          } else {
            reject(res.result.error)
          }
        },
        fail: (err) => {
          console.error('加载月度统计失败:', err)
          reject(err)
        }
      })
    })
  },

  generateCalendarData: function (stats) {
    const { currentYear, currentMonth, dailyStats } = this.data
    const firstDay = new Date(currentYear, currentMonth - 1, 1)
    const lastDay = new Date(currentYear, currentMonth, 0)
    const daysInMonth = lastDay.getDate()
    const firstDayOfWeek = firstDay.getDay()

    const calendarData = []
    const weekDays = ['日', '一', '二', '三', '四', '五', '六']
    
    calendarData.push(weekDays.map(day => ({
      type: 'weekday',
      label: day
    })))

    let currentWeek = []
    
    for (let i = 0; i < firstDayOfWeek; i++) {
      currentWeek.push({
        type: 'empty'
      })
    }

    const today = new Date()
    const todayStr = this.formatDate(today)

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      const dayStats = dailyStats[dateStr]
      const isToday = dateStr === todayStr
      const isPast = new Date(dateStr) < new Date(today.setHours(0, 0, 0, 0))
      
      today.setHours(0, 0, 0, 0)
      
      currentWeek.push({
        type: 'day',
        day: day,
        dateStr: dateStr,
        isToday: isToday,
        isPast: isPast,
        hasCheckins: !!dayStats,
        checkinCount: dayStats ? dayStats.totalCheckins : 0
      })

      if (currentWeek.length === 7) {
        calendarData.push(currentWeek)
        currentWeek = []
      }
    }

    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push({
          type: 'empty'
        })
      }
      calendarData.push(currentWeek)
    }

    this.setData({ calendarData })
  },

  calculateTotalStats: function () {
    const { habits } = this.data
    
    let totalCheckins = 0
    let maxCurrentStreak = 0
    let maxLongestStreak = 0

    habits.forEach(habit => {
      totalCheckins += habit.totalCheckins || 0
      maxCurrentStreak = Math.max(maxCurrentStreak, habit.currentStreak || 0)
      maxLongestStreak = Math.max(maxLongestStreak, habit.longestStreak || 0)
    })

    this.setData({
      totalStats: {
        totalHabits: habits.length,
        totalCheckins: totalCheckins,
        maxCurrentStreak: maxCurrentStreak,
        maxLongestStreak: maxLongestStreak
      }
    })
  },

  onPrevMonth: function () {
    let { currentYear, currentMonth } = this.data
    currentMonth--
    if (currentMonth < 1) {
      currentMonth = 12
      currentYear--
    }
    this.setData({ currentYear, currentMonth })
    this.loadMonthlyStats()
  },

  onNextMonth: function () {
    let { currentYear, currentMonth } = this.data
    currentMonth++
    if (currentMonth > 12) {
      currentMonth = 1
      currentYear++
    }
    this.setData({ currentYear, currentMonth })
    this.loadMonthlyStats()
  },

  onDateClick: function (e) {
    const { dateStr, isPast, hasCheckins } = e.currentTarget.dataset
    
    if (!isPast && !hasCheckins) {
      wx.showToast({
        title: '只能补签过去的日期',
        icon: 'none'
      })
      return
    }

    this.setData({
      selectedDate: dateStr,
      supplementDate: dateStr,
      showSupplementModal: true
    })

    this.prepareSupplementData(dateStr)
  },

  prepareSupplementData: function (dateStr) {
    const { habits, dailyStats } = this.data
    const dayStats = dailyStats[dateStr]
    const checkedHabitIds = dayStats ? dayStats.habits.map(h => h.habitId) : []

    const availableHabits = habits.map(habit => ({
      ...habit,
      isChecked: checkedHabitIds.includes(habit._id)
    }))

    this.setData({ availableHabits })
  },

  onHabitToggle: function (e) {
    const habitId = e.currentTarget.dataset.id
    const { availableHabits } = this.data

    const updatedHabits = availableHabits.map(habit => {
      if (habit._id === habitId) {
        return { ...habit, isChecked: !habit.isChecked }
      }
      return habit
    })

    this.setData({ availableHabits: updatedHabits })
  },

  onSupplementConfirm: function () {
    const { availableHabits, supplementDate } = this.data
    const habitsToCheckin = availableHabits.filter(h => h.isChecked && !h.isAlreadyChecked)

    if (habitsToCheckin.length === 0) {
      this.setData({ showSupplementModal: false })
      return
    }

    wx.showLoading({ title: '补签中...' })

    const checkinPromises = habitsToCheckin.map(habit => {
      return new Promise((resolve) => {
        wx.cloud.callFunction({
          name: 'checkin',
          data: {
            habitId: habit._id,
            checkinDate: supplementDate,
            isSupplement: true
          },
          success: (res) => {
            if (res.result.success) {
              resolve(true)
            } else {
              console.error('补签失败:', res.result.error)
              resolve(false)
            }
          },
          fail: (err) => {
            console.error('补签失败:', err)
            resolve(false)
          }
        })
      })
    })

    Promise.all(checkinPromises).then((results) => {
      wx.hideLoading()
      
      const successCount = results.filter(r => r).length
      if (successCount > 0) {
        wx.showToast({
          title: `补签成功 ${successCount} 个`,
          icon: 'success'
        })
        this.setData({ showSupplementModal: false })
        this.loadData()
      } else {
        wx.showToast({
          title: '补签失败',
          icon: 'none'
        })
      }
    })
  },

  onCloseSupplementModal: function () {
    this.setData({ showSupplementModal: false })
  },

  onGoLogin: function () {
    wx.navigateTo({
      url: '/pages/login/login?redirectUrl=/pages/profile/profile'
    })
  },

  formatDate: function (date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
})
