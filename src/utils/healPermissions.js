import User from '../models/User.js'
import { normalizePermission } from './permissions.js'

/** Fix legacy Compass/manual values like "administrator " so enum checks succeed. */
export async function healUserPermissions() {
  const users = await User.collection.find({}, { projection: { permission: 1 } }).toArray()
  let fixed = 0

  for (const user of users) {
    const next = normalizePermission(user.permission)
    if (!next || next === user.permission) continue

    await User.collection.updateOne({ _id: user._id }, { $set: { permission: next } })
    fixed += 1
  }

  if (fixed > 0) {
    console.log(`Normalized permission values on ${fixed} user(s).`)
  }
}
