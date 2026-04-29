const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()
const checkinsCollection = db.collection('checkins')
const habitsCollection = db.collection('habits')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { year, month } = event

  if (!year || !month) {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }

  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const lastDay = getLastDayOfMonth(year, month)
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

    const habitsResult = await habitsCollection.where({
      _openid: wxContext.OPENID,
      isActive: true
    }).get()

    const habits = habitsResult.data

    const checkinsResult = await checkinsCollection.where({
      _openid: wxContext.OPENID,
      checkinDate: db.command.gte(startDate).and(db.command.lte(endDate))
    }).orderBy('checkinDate', 'asc').get()

    const checkins = checkinsResult.data

    const dailyStats = {}
    const habitDailyMap = {}

    checkins.forEach(checkin => {
      const date = checkin.checkinDate
      const habitId = checkin.habitId

      if (!dailyStats[date]) {
        dailyStats[date] = {
          date: date,
          totalCheckins: 0,
          habits: []
        }
      }

      dailyStats[date].totalCheckins++
      dailyStats[date].habits.push({
        habitId: habitId,
        isSupplement: checkin.isSupplement
      })

      if (!habitDailyMap[habitId]) {
        habitDailyMap[habitId] = []
      }
      habitDailyMap[habitId].push(date)
    })

    const habitStats = habits.map(habit => {
      const habitCheckins = habitDailyMap[habit._id] || []
      return {
        habitId: habit._id,
        habitName: habit.name,
        habitIcon: habit.icon,
        totalCheckins: habitCheckins.length,
        currentStreak: habit.currentStreak,
        longestStreak: habit.longestStreak,
        checkinDates: habitCheckins
      }
    })

    const totalDaysInMonth = lastDay
    const daysWithCheckins = Object.keys(dailyStats).length
    const totalCheckinsThisMonth = checkins.length

    return {
      success: true,
      data: {
        year: year,
        month: month,
        totalDaysInMonth: totalDaysInMonth,
        daysWithCheckins: daysWithCheckins,
        totalCheckinsThisMonth: totalCheckinsThisMonth,
        dailyStats: dailyStats,
        habitStats: habitStats,
        habits: habits
      }
    }
  } catch (err) {
    console.error('获取月度统计失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}

function getLastDayOfMonth(year, month) {
  return new Date(year, month, 0).getDate()
}
