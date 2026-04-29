const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()
const habitsCollection = db.collection('habits')

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { status = 'active' } = event

  try {
    let query = habitsCollection.where({
      _openid: wxContext.OPENID
    })

    if (status === 'active') {
      query = query.where({
        isActive: true
      })
    }

    const result = await query.orderBy('createTime', 'desc').get()
    
    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    console.error('获取习惯列表失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
}
