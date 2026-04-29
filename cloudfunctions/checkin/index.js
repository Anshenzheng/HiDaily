const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()
const habitsCollection = db.collection('habits')
const checkinsCollection = db.collection('checkins')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { habitId, checkinDate, isSupplement = false } = event

  if (!habitId) {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }

  try {
    const now = new Date()
    const dateToCheckin = checkinDate ? new Date(checkinDate) : now
    const dateStr = formatDate(dateToCheckin)

    const existingCheckin = await checkinsCollection.where({
      _openid: wxContext.OPENID,
      habitId: habitId,
      checkinDate: dateStr
    }).get()

    if (existingCheckin.data.length > 0) {
      return {
        success: false,
        error: '今日已打卡'
      }
    }

    const checkinData = {
      habitId: habitId,
      checkinDate: dateStr,
      checkinTime: db.serverDate(),
      isSupplement: isSupplement,
      _openid: wxContext.OPENID
    }

    const checkinResult = await checkinsCollection.add({
      data: checkinData
    })

    await updateHabitStats(habitId, wxContext.OPENID)

    return {
      success: true,
      data: {
        _id: checkinResult._id,
        ...checkinData
      }
    }
  } catch (err) {
    console.error('打卡失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}

async function updateHabitStats(habitId, openid) {
  const habitResult = await habitsCollection.where({
    _id: habitId,
    _openid: openid
  }).get()

  if (habitResult.data.length === 0) {
    return
  }

  const habit = habitResult.data[0]
  
  const checkinsResult = await checkinsCollection.where({
    habitId: habitId,
    _openid: openid
  }).orderBy('checkinDate', 'desc').get()

  const checkins = checkinsResult.data
  const totalCheckins = checkins.length
  const currentStreak = calculateCurrentStreak(checkins)
  const longestStreak = Math.max(habit.longestStreak, currentStreak)

  await habitsCollection.doc(habit._id).update({
    data: {
      totalCheckins: totalCheckins,
      currentStreak: currentStreak,
      longestStreak: longestStreak
    }
  })
}

function calculateCurrentStreak(checkins) {
  if (checkins.length === 0) return 0

  const today = formatDate(new Date())
  const yesterday = formatDate(new Date(Date.now() - 86400000))
  
  const sortedDates = checkins.map(c => c.checkinDate).sort().reverse()
  
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0
  }

  let streak = 0
  let currentDate = new Date(sortedDates[0])

  for (let i = 0; i < sortedDates.length; i++) {
    const checkinDateStr = sortedDates[i]
    const expectedDateStr = formatDate(currentDate)

    if (checkinDateStr === expectedDateStr) {
      streak++
      currentDate = new Date(currentDate.getTime() - 86400000)
    } else {
      break
    }
  }

  return streak
}

function formatDate(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
