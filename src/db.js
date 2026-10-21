import mongoose from 'mongoose'

export async function connectDatabase(uri) {
  return mongoose.connect(uri)
}
