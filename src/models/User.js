import mongoose from 'mongoose'
import { USER_PERMISSIONS, normalizePermission } from '../utils/permissions.js'

export { USER_PERMISSIONS }

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 40,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false,
    },
    avatar: {
      type: String,
      default: '',
      trim: true,
    },
    permission: {
      type: String,
      enum: USER_PERMISSIONS,
      default: 'unauthorized',
      required: true,
      set: (value) => normalizePermission(value) ?? value,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id
        ret.permission = normalizePermission(ret.permission) ?? ret.permission
        delete ret._id
        delete ret.__v
        delete ret.password
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id
        ret.permission = normalizePermission(ret.permission) ?? ret.permission
        delete ret._id
        delete ret.__v
        delete ret.password
      },
    },
  },
)

const User = mongoose.models.User || mongoose.model('User', userSchema)
export default User
