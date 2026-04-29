const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()
const habitsCollection = db.collection('habits')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { name, icon, frequencyType, frequencyValue, reminderTime, description } = event

  if (!name || !frequencyType) {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }

  try {
    const habitData = {
      name: name,
      icon: icon || '⭐',
      frequencyType: frequencyType,
      frequencyValue: frequencyValue || 1,
      reminderTime: reminderTime || null,
      description: description || '',
      isActive: true,
      currentStreak: 0,
      longestStreak: 0,
      totalCheckins: 0,
      createTime: db.serverDate(),
      _openid: wxContext.OPENID
    }

    const result = await habitsCollection.add({
      data: habitData
    })

    return {
      success: true,
      data: {
        _id: result._id,
        ...habitData
      }
    }
  } catch (err) {
    console.error('创建习惯失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
