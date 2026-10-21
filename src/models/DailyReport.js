import mongoose from 'mongoose'

const dailyReportSchema = new mongoose.Schema(
  {
    date: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      trim: true,
      default: '',
      maxlength: 40,
    },
    userId: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    bidNumber: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    other: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id
        delete ret._id
        delete ret.__v
      },
    },
    toObject: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = ret._id
        delete ret._id
        delete ret.__v
      },
    },
  },
)

const DailyReport =
  mongoose.models.DailyReport || mongoose.model('DailyReport', dailyReportSchema)

export default DailyReport
