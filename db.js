const { Sequelize, DataTypes } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: false,
  }
);

const modelOptions = (tableName) => ({
  tableName,
  freezeTableName: true,
  timestamps: true,
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
});

const User = sequelize.define(
  'User',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    googleId: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    email: { type: DataTypes.STRING(255), unique: true, allowNull: false },
    name: { type: DataTypes.STRING(255), allowNull: false },
    role: {
      type: DataTypes.ENUM('Admin', 'Approver', 'Volunteer', 'Member'),
      allowNull: false,
      defaultValue: 'Member',
    },
    isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  modelOptions('users')
);

const Event = sequelize.define(
  'Event',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    eventName: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT },
    location: { type: DataTypes.STRING(255) },
    dateStart: { type: DataTypes.DATE, allowNull: false },
    dateEnd: { type: DataTypes.DATE, allowNull: false },
    isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    createdBy: { type: DataTypes.INTEGER },
  },
  modelOptions('events')
);

const UploadBatch = sequelize.define(
  'UploadBatch',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    eventId: { type: DataTypes.INTEGER, allowNull: false },
    uploaderId: { type: DataTypes.INTEGER },
    guestName: { type: DataTypes.STRING(150) },
    batchStatus: {
      type: DataTypes.ENUM('Pending', 'Approved'),
      allowNull: false,
      defaultValue: 'Pending',
    },
  },
  modelOptions('uploadBatches')
);

const Photo = sequelize.define(
  'Photo',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(255) },
    s3Key: { type: DataTypes.STRING(255), allowNull: false },
    url: { type: DataTypes.STRING(500), allowNull: false },
    description: { type: DataTypes.TEXT },
    status: {
      type: DataTypes.ENUM('Pending', 'Approved'),
      allowNull: false,
      defaultValue: 'Pending',
    },
    eventId: { type: DataTypes.INTEGER, allowNull: false },
    batchId: { type: DataTypes.INTEGER },
    uploaderId: { type: DataTypes.INTEGER },
    guestName: { type: DataTypes.STRING(150) },
    approverId: { type: DataTypes.INTEGER },
    approvedAt: { type: DataTypes.DATE },
  },
  modelOptions('photos')
);

const Flyer = sequelize.define(
  'Flyer',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: DataTypes.STRING(255), allowNull: false },
    s3Key: { type: DataTypes.STRING(255), allowNull: false },
    url: { type: DataTypes.STRING(500), allowNull: false },
    eventId: { type: DataTypes.INTEGER },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    isPublished: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  },
  modelOptions('flyers')
);

const LangarBooking = sequelize.define(
  'LangarBooking',
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    bookingDate: { type: DataTypes.DATEONLY, allowNull: false },
    status: {
      type: DataTypes.ENUM('Requested', 'Approved', 'Cancelled'),
      allowNull: false,
      defaultValue: 'Requested',
    },
    occasionNotes: { type: DataTypes.TEXT },
    volunteerId: { type: DataTypes.INTEGER },
    guestName: { type: DataTypes.STRING(150) },
    guestEmail: { type: DataTypes.STRING(255) },
    guestPhone: { type: DataTypes.STRING(30) },
    approverId: { type: DataTypes.INTEGER },
    approvedAt: { type: DataTypes.DATE },
  },
  modelOptions('langarBookings')
);

Event.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
UploadBatch.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
UploadBatch.belongsTo(User, { foreignKey: 'uploaderId', as: 'uploader' });
Photo.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
Photo.belongsTo(UploadBatch, { foreignKey: 'batchId', as: 'batch' });
Photo.belongsTo(User, { foreignKey: 'uploaderId', as: 'uploader' });
Photo.belongsTo(User, { foreignKey: 'approverId', as: 'approver' });
Flyer.belongsTo(Event, { foreignKey: 'eventId', as: 'event' });
Flyer.belongsTo(User, { foreignKey: 'userId', as: 'creator' });
LangarBooking.belongsTo(User, { foreignKey: 'volunteerId', as: 'volunteer' });
LangarBooking.belongsTo(User, { foreignKey: 'approverId', as: 'approver' });

module.exports = {
  sequelize,
  User,
  Event,
  UploadBatch,
  Photo,
  Flyer,
  LangarBooking,
};
