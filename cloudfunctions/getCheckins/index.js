const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()
const checkinsCollection = db.collection('checkins')
const habitsCollection = db.collection('habits')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { habitId, startDate, endDate, date } = event

  try {
    let query = checkinsCollection.where({
      _openid: wxContext.OPENID
    })

    if (habitId) {
      query = query.where({
        habitId: habitId
      })
    }

    if (date) {
      query = query.where({
        checkinDate: date
      })
    } else if (startDate && endDate) {
      query = query.where({
        checkinDate: db.command.gte(startDate).and(db.command.lte(endDate))
      })
    }

    const result = await query.orderBy('checkinDate', 'desc').get()

    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    console.error('获取打卡记录失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
