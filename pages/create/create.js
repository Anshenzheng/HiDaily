const app = getApp()

Page({
  data: {
    name: '',
    selectedIcon: '⭐',
    frequencyType: 'daily',
    frequencyValue: 1,
    reminderTime: '',
    hasReminder: false,
    description: '',
    
    icons: [
      { emoji: '⭐', label: '星星' },
      { emoji: '💪', label: '健身' },
      { emoji: '📚', label: '学习' },
      { emoji: '🏃', label: '跑步' },
      { emoji: '💧', label: '喝水' },
      { emoji: '🥗', label: '健康' },
      { emoji: '😴', label: '睡眠' },
      { emoji: '📝', label: '写作' },
      { emoji: '🎨', label: '艺术' },
      { emoji: '🎵', label: '音乐' },
      { emoji: '🌱', label: '成长' },
      { emoji: '🔥', label: '挑战' }
    ],
    
    frequencyTypes: [
      { value: 'daily', label: '每天' },
      { value: 'weekly', label: '每周' },
      { value: 'monthly', label: '每月' }
    ],
    
    weeklyDays: [
      { value: 1, label: '周一', selected: false },
      { value: 2, label: '周二', selected: false },
      { value: 3, label: '周三', selected: false },
      { value: 4, label: '周四', selected: false },
      { value: 5, label: '周五', selected: false },
      { value: 6, label: '周六', selected: false },
      { value: 7, label: '周日', selected: false }
    ]
  },

  onLoad: function (options) {
    if (options.edit) {
      this.setData({ isEdit: true, habitId: options.id })
      this.loadHabitData(options.id)
    }
  },

  loadHabitData: function(habitId) {
    const db = wx.cloud.database()
    db.collection('habits').doc(habitId).get().then(res => {
      const habit = res.data
      this.setData({
        name: habit.name,
        selectedIcon: habit.icon,
        frequencyType: habit.frequencyType,
        frequencyValue: habit.frequencyValue,
        hasReminder: !!habit.reminderTime,
        reminderTime: habit.reminderTime || '',
        description: habit.description || ''
      })
    })
  },

  onNameInput: function(e) {
    this.setData({ name: e.detail.value })
  },

  onIconSelect: function(e) {
    const icon = e.currentTarget.dataset.icon
    this.setData({ selectedIcon: icon })
  },

  onFrequencyTypeChange: function(e) {
    const type = e.detail.value
    this.setData({ 
      frequencyType: type,
      frequencyValue: type === 'daily' ? 1 : (type === 'weekly' ? 3 : 1)
    })
  },

  onFrequencyValueChange: function(e) {
    this.setData({ frequencyValue: parseInt(e.detail.value) })
  },

  onWeekDayToggle: function(e) {
    const index = e.currentTarget.dataset.index
    const weeklyDays = [...this.data.weeklyDays]
    weeklyDays[index].selected = !weeklyDays[index].selected
    this.setData({ weeklyDays })
  },

  onReminderToggle: function(e) {
    this.setData({ hasReminder: e.detail.value })
  },

  onTimeChange: function(e) {
    this.setData({ reminderTime: e.detail.value })
  },

  onDescriptionInput: function(e) {
    this.setData({ description: e.detail.value })
  },

  onSubmit: function() {
    const { name, selectedIcon, frequencyType, frequencyValue, hasReminder, reminderTime, description, isEdit, habitId } = this.data

    if (!name.trim()) {
      wx.showToast({
        title: '请输入习惯名称',
        icon: 'none'
      })
      return
    }

    if (frequencyType === 'weekly' && frequencyValue < 1) {
      wx.showToast({
        title: '请设置每周频率',
        icon: 'none'
      })
      return
    }

    if (frequencyType === 'monthly' && frequencyValue < 1) {
      wx.showToast({
        title: '请设置每月频率',
        icon: 'none'
      })
      return
    }

    this.setData({ isSubmitting: true })

    const habitData = {
      name: name.trim(),
      icon: selectedIcon,
      frequencyType: frequencyType,
      frequencyValue: frequencyValue,
      reminderTime: hasReminder ? reminderTime : null,
      description: description.trim()
    }

    if (isEdit) {
      this.updateHabit(habitId, habitData)
    } else {
      this.createHabit(habitData)
    }
  },

  createHabit: function(habitData) {
    wx.cloud.callFunction({
      name: 'createHabit',
      data: habitData,
      success: (res) => {
        if (res.result.success) {
          wx.showToast({
            title: '创建成功',
            icon: 'success'
          })
          
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/index/index'
            })
          }, 1000)
        } else {
          wx.showToast({
            title: res.result.error || '创建失败',
            icon: 'none'
          })
          this.setData({ isSubmitting: false })
        }
      },
      fail: (err) => {
        console.error('创建习惯失败:', err)
        wx.showToast({
          title: '创建失败，请稍后重试',
          icon: 'none'
        })
        this.setData({ isSubmitting: false })
      }
    })
  },

  updateHabit: function(habitId, habitData) {
    const db = wx.cloud.database()
    db.collection('habits').doc(habitId).update({
      data: habitData,
      success: () => {
        wx.showToast({
          title: '更新成功',
          icon: 'success'
        })
        
        setTimeout(() => {
          wx.navigateBack()
        }, 1000)
      },
      fail: (err) => {
        console.error('更新习惯失败:', err)
        wx.showToast({
          title: '更新失败，请稍后重试',
          icon: 'none'
        })
        this.setData({ isSubmitting: false })
      }
    })
  },

  onDeleteHabit: function() {
    if (!this.data.isEdit) return

    wx.showModal({
      title: '确认删除',
      content: '删除后将无法恢复，确定要删除这个习惯吗？',
      success: (res) => {
        if (res.confirm) {
          this.doDeleteHabit()
        }
      }
    })
  },

  doDeleteHabit: function() {
    const db = wx.cloud.database()
    db.collection('habits').doc(this.data.habitId).update({
      data: {
        isActive: false
      },
      success: () => {
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        })
        
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/index/index'
          })
        }, 1000)
      },
      fail: (err) => {
        console.error('删除习惯失败:', err)
        wx.showToast({
          title: '删除失败，请稍后重试',
          icon: 'none'
        })
      }
    })
  }
})
