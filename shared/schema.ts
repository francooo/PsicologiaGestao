import { pgTable, text, serial, integer, boolean, date, time, decimal, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

// User & Auth related schemas
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("psychologist"), // admin, psychologist, receptionist
  status: text("status").notNull().default("active"), // active, inactive, pending
  profileImage: text("profile_image"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
  email: true,
  fullName: true,
  role: true,
  status: true,
  profileImage: true,
});

// Psychologist specific info
export const psychologists = pgTable("psychologists", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  specialization: text("specialization"),
  bio: text("bio"),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
});

export const insertPsychologistSchema = createInsertSchema(psychologists).pick({
  userId: true,
  specialization: true,
  bio: true,
  hourlyRate: true,
});

// Rooms
export const rooms = pgTable("rooms", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  capacity: integer("capacity").notNull(),
  hasWifi: boolean("has_wifi").notNull().default(true),
  hasAirConditioning: boolean("has_air_conditioning").notNull().default(true),
  squareMeters: integer("square_meters"),
  imageUrl: text("image_url"),
});

export const insertRoomSchema = createInsertSchema(rooms).pick({
  name: true,
  capacity: true,
  hasWifi: true,
  hasAirConditioning: true,
  squareMeters: true,
  imageUrl: true,
});

// Appointments
export const appointments = pgTable("appointments", {
  id: serial("id").primaryKey(),
  patientName: text("patient_name").notNull(),
  psychologistId: integer("psychologist_id").notNull(),
  roomId: integer("room_id").notNull(),
  date: date("date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  status: text("status").notNull().default("scheduled"), // scheduled, confirmed, canceled, completed
  notes: text("notes"),
});

export const insertAppointmentSchema = createInsertSchema(appointments).pick({
  patientName: true,
  psychologistId: true,
  roomId: true,
  date: true,
  startTime: true,
  endTime: true,
  status: true,
  notes: true,
});

// Finances
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  type: text("type").notNull(), // income, expense
  category: text("category").notNull(),
  date: date("date").notNull(),
  responsibleId: integer("responsible_id").notNull(),
  relatedAppointmentId: integer("related_appointment_id"),
});

export const insertTransactionSchema = createInsertSchema(transactions).pick({
  description: true,
  amount: true,
  type: true,
  category: true,
  date: true,
  responsibleId: true,
  relatedAppointmentId: true,
});

// Room bookings
export const roomBookings = pgTable("room_bookings", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull(),
  psychologistId: integer("psychologist_id").notNull(),
  date: date("date").notNull(),
  startTime: time("start_time").notNull(),
  endTime: time("end_time").notNull(),
  purpose: text("purpose"),
});

export const insertRoomBookingSchema = createInsertSchema(roomBookings).pick({
  roomId: true,
  psychologistId: true,
  date: true,
  startTime: true,
  endTime: true,
  purpose: true,
});

// Permissions
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
});

export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  role: text("role").notNull(),
  permissionId: integer("permission_id").notNull(),
});

export const insertPermissionSchema = createInsertSchema(permissions).pick({
  name: true,
  description: true,
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).pick({
  role: true,
  permissionId: true,
});

// Define relations
export const usersRelations = relations(users, ({ one, many }) => ({
  psychologist: one(psychologists, {
    fields: [users.id],
    references: [psychologists.userId],
  }),
  transactions: many(transactions, {
    relationName: "userTransactions",
  }),
}));

export const psychologistsRelations = relations(psychologists, ({ one, many }) => ({
  user: one(users, {
    fields: [psychologists.userId],
    references: [users.id],
  }),
  appointments: many(appointments, {
    relationName: "psychologistAppointments",
  }),
  roomBookings: many(roomBookings, {
    relationName: "psychologistRoomBookings",
  }),
}));

export const roomsRelations = relations(rooms, ({ many }) => ({
  appointments: many(appointments, {
    relationName: "roomAppointments",
  }),
  bookings: many(roomBookings, {
    relationName: "roomBookings",
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one, many }) => ({
  psychologist: one(psychologists, {
    fields: [appointments.psychologistId],
    references: [psychologists.id],
  }),
  room: one(rooms, {
    fields: [appointments.roomId],
    references: [rooms.id],
  }),
  transactions: many(transactions, {
    relationName: "appointmentTransactions",
  }),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  responsibleUser: one(users, {
    fields: [transactions.responsibleId],
    references: [users.id],
    relationName: "userTransactions",
  }),
  appointment: one(appointments, {
    fields: [transactions.relatedAppointmentId],
    references: [appointments.id],
    relationName: "appointmentTransactions",
  }),
}));

export const roomBookingsRelations = relations(roomBookings, ({ one }) => ({
  room: one(rooms, {
    fields: [roomBookings.roomId],
    references: [rooms.id],
    relationName: "roomBookings",
  }),
  psychologist: one(psychologists, {
    fields: [roomBookings.psychologistId],
    references: [psychologists.id],
    relationName: "psychologistRoomBookings",
  }),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  rolePermissions: many(rolePermissions, {
    relationName: "permissionRoles",
  }),
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id],
    relationName: "permissionRoles",
  }),
}));

// Export types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Psychologist = typeof psychologists.$inferSelect;
export type InsertPsychologist = z.infer<typeof insertPsychologistSchema>;

export type Room = typeof rooms.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;

export type Appointment = typeof appointments.$inferSelect;
export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type RoomBooking = typeof roomBookings.$inferSelect;
export type InsertRoomBooking = z.infer<typeof insertRoomBookingSchema>;

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;

export type RolePermission = typeof rolePermissions.$inferSelect;
export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
