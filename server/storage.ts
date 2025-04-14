import { 
  users, type User, type InsertUser, 
  psychologists, type Psychologist, type InsertPsychologist,
  rooms, type Room, type InsertRoom,
  appointments, type Appointment, type InsertAppointment,
  transactions, type Transaction, type InsertTransaction,
  roomBookings, type RoomBooking, type InsertRoomBooking,
  permissions, type Permission, type InsertPermission,
  rolePermissions, type RolePermission, type InsertRolePermission
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import connectPg from "connect-pg-simple";
import { db, pool } from "./db";
import { eq, and, gte, lte, sql } from "drizzle-orm";

const MemoryStore = createMemoryStore(session);
const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // User related methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, user: Partial<User>): Promise<User | undefined>;
  deleteUser(id: number): Promise<boolean>;
  getAllUsers(): Promise<User[]>;

  // Psychologist related methods
  getPsychologist(id: number): Promise<Psychologist | undefined>;
  getPsychologistByUserId(userId: number): Promise<Psychologist | undefined>;
  createPsychologist(psychologist: InsertPsychologist): Promise<Psychologist>;
  updatePsychologist(id: number, psychologist: Partial<Psychologist>): Promise<Psychologist | undefined>;
  deletePsychologist(id: number): Promise<boolean>;
  getAllPsychologists(): Promise<Psychologist[]>;

  // Room related methods
  getRoom(id: number): Promise<Room | undefined>;
  createRoom(room: InsertRoom): Promise<Room>;
  updateRoom(id: number, room: Partial<Room>): Promise<Room | undefined>;
  deleteRoom(id: number): Promise<boolean>;
  getAllRooms(): Promise<Room[]>;

  // Appointment related methods
  getAppointment(id: number): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: number, appointment: Partial<Appointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: number): Promise<boolean>;
  getAllAppointments(): Promise<Appointment[]>;
  getAppointmentsByPsychologistId(psychologistId: number): Promise<Appointment[]>;
  getAppointmentsByDate(date: Date): Promise<Appointment[]>;
  getAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]>;

  // Transaction related methods
  getTransaction(id: number): Promise<Transaction | undefined>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, transaction: Partial<Transaction>): Promise<Transaction | undefined>;
  deleteTransaction(id: number): Promise<boolean>;
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionsByType(type: string): Promise<Transaction[]>;
  getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]>;

  // Room booking related methods
  getRoomBooking(id: number): Promise<RoomBooking | undefined>;
  createRoomBooking(roomBooking: InsertRoomBooking): Promise<RoomBooking>;
  updateRoomBooking(id: number, roomBooking: Partial<RoomBooking>): Promise<RoomBooking | undefined>;
  deleteRoomBooking(id: number): Promise<boolean>;
  getAllRoomBookings(): Promise<RoomBooking[]>;
  getRoomBookingsByRoomId(roomId: number): Promise<RoomBooking[]>;
  getRoomBookingsByDate(date: Date): Promise<RoomBooking[]>;
  getRoomBookingsByDateRange(startDate: Date, endDate: Date): Promise<RoomBooking[]>;
  checkRoomAvailability(roomId: number, date: Date, startTime: string, endTime: string): Promise<boolean>;

  // Permission related methods
  getPermission(id: number): Promise<Permission | undefined>;
  createPermission(permission: InsertPermission): Promise<Permission>;
  updatePermission(id: number, permission: Partial<Permission>): Promise<Permission | undefined>;
  deletePermission(id: number): Promise<boolean>;
  getAllPermissions(): Promise<Permission[]>;

  // Role permission related methods
  getRolePermission(id: number): Promise<RolePermission | undefined>;
  createRolePermission(rolePermission: InsertRolePermission): Promise<RolePermission>;
  updateRolePermission(id: number, rolePermission: Partial<RolePermission>): Promise<RolePermission | undefined>;
  deleteRolePermission(id: number): Promise<boolean>;
  getAllRolePermissions(): Promise<RolePermission[]>;
  getRolePermissionsByRole(role: string): Promise<RolePermission[]>;

  // Session store
  sessionStore: session.Store;
  getUserByEmail: (email: string) => Promise<User | undefined>;
  savePasswordResetToken: (userId: number, token: string) => Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private psychologists: Map<number, Psychologist>;
  private rooms: Map<number, Room>;
  private appointments: Map<number, Appointment>;
  private transactions: Map<number, Transaction>;
  private roomBookings: Map<number, RoomBooking>;
  private permissions: Map<number, Permission>;
  private rolePermissions: Map<number, RolePermission>;

  // For auto-incrementing IDs
  private userIdCounter: number = 1;
  private psychologistIdCounter: number = 1;
  private roomIdCounter: number = 1;
  private appointmentIdCounter: number = 1;
  private transactionIdCounter: number = 1;
  private roomBookingIdCounter: number = 1;
  private permissionIdCounter: number = 1;
  private rolePermissionIdCounter: number = 1;

  sessionStore: session.Store;

  constructor() {
    this.users = new Map();
    this.psychologists = new Map();
    this.rooms = new Map();
    this.appointments = new Map();
    this.transactions = new Map();
    this.roomBookings = new Map();
    this.permissions = new Map();
    this.rolePermissions = new Map();

    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });

    // Initialize with default permissions
    this.initDefaultData();
  }

  private initDefaultData() {
    // Create default permissions
    const defaultPermissions = [
      { name: "dashboard_view", description: "View dashboard" },
      { name: "appointments_view", description: "View appointments" },
      { name: "appointments_manage", description: "Manage appointments" },
      { name: "psychologists_view", description: "View psychologists" },
      { name: "psychologists_manage", description: "Manage psychologists" },
      { name: "rooms_view", description: "View rooms" },
      { name: "rooms_manage", description: "Manage rooms" },
      { name: "rooms_book", description: "Book rooms" },
      { name: "financial_view", description: "View financial information" },
      { name: "financial_manage", description: "Manage financial information" },
      { name: "permissions_view", description: "View permissions" },
      { name: "permissions_manage", description: "Manage permissions" }
    ];

    defaultPermissions.forEach(permission => {
      this.createPermission({
        name: permission.name,
        description: permission.description
      });
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = this.userIdCounter++;
    const newUser: User = { ...user, id };
    this.users.set(id, newUser);
    return newUser;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const existingUser = this.users.get(id);
    if (!existingUser) return undefined;

    const updatedUser = { ...existingUser, ...userData };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    return this.users.delete(id);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  // Psychologist methods
  async getPsychologist(id: number): Promise<Psychologist | undefined> {
    return this.psychologists.get(id);
  }

  async getPsychologistByUserId(userId: number): Promise<Psychologist | undefined> {
    return Array.from(this.psychologists.values()).find(psych => psych.userId === userId);
  }

  async createPsychologist(psychologist: InsertPsychologist): Promise<Psychologist> {
    const id = this.psychologistIdCounter++;
    const newPsychologist: Psychologist = { ...psychologist, id };
    this.psychologists.set(id, newPsychologist);
    return newPsychologist;
  }

  async updatePsychologist(id: number, psychologistData: Partial<Psychologist>): Promise<Psychologist | undefined> {
    const existingPsychologist = this.psychologists.get(id);
    if (!existingPsychologist) return undefined;

    const updatedPsychologist = { ...existingPsychologist, ...psychologistData };
    this.psychologists.set(id, updatedPsychologist);
    return updatedPsychologist;
  }

  async deletePsychologist(id: number): Promise<boolean> {
    return this.psychologists.delete(id);
  }

  async getAllPsychologists(): Promise<Psychologist[]> {
    return Array.from(this.psychologists.values());
  }

  // Room methods
  async getRoom(id: number): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  async createRoom(room: InsertRoom): Promise<Room> {
    const id = this.roomIdCounter++;
    const newRoom: Room = { ...room, id };
    this.rooms.set(id, newRoom);
    return newRoom;
  }

  async updateRoom(id: number, roomData: Partial<Room>): Promise<Room | undefined> {
    const existingRoom = this.rooms.get(id);
    if (!existingRoom) return undefined;

    const updatedRoom = { ...existingRoom, ...roomData };
    this.rooms.set(id, updatedRoom);
    return updatedRoom;
  }

  async deleteRoom(id: number): Promise<boolean> {
    return this.rooms.delete(id);
  }

  async getAllRooms(): Promise<Room[]> {
    return Array.from(this.rooms.values());
  }

  // Appointment methods
  async getAppointment(id: number): Promise<Appointment | undefined> {
    return this.appointments.get(id);
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const id = this.appointmentIdCounter++;
    const newAppointment: Appointment = { ...appointment, id };
    this.appointments.set(id, newAppointment);
    return newAppointment;
  }

  async updateAppointment(id: number, appointmentData: Partial<Appointment>): Promise<Appointment | undefined> {
    const existingAppointment = this.appointments.get(id);
    if (!existingAppointment) return undefined;

    const updatedAppointment = { ...existingAppointment, ...appointmentData };
    this.appointments.set(id, updatedAppointment);
    return updatedAppointment;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    return this.appointments.delete(id);
  }

  async getAllAppointments(): Promise<Appointment[]> {
    return Array.from(this.appointments.values());
  }

  async getAppointmentsByPsychologistId(psychologistId: number): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(appointment => appointment.psychologistId === psychologistId);
  }

  async getAppointmentsByDate(date: Date): Promise<Appointment[]> {
    const dateString = date.toISOString().split('T')[0];
    return Array.from(this.appointments.values())
      .filter(appointment => {
        const appointmentDate = new Date(appointment.date).toISOString().split('T')[0];
        return appointmentDate === dateString;
      });
  }

  async getAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    return Array.from(this.appointments.values())
      .filter(appointment => {
        const appointmentDate = new Date(appointment.date);
        return appointmentDate >= startDate && appointmentDate <= endDate;
      });
  }

  // Transaction methods
  async getTransaction(id: number): Promise<Transaction | undefined> {
    return this.transactions.get(id);
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = this.transactionIdCounter++;
    const newTransaction: Transaction = { ...transaction, id };
    this.transactions.set(id, newTransaction);
    return newTransaction;
  }

  async updateTransaction(id: number, transactionData: Partial<Transaction>): Promise<Transaction | undefined> {
    const existingTransaction = this.transactions.get(id);
    if (!existingTransaction) return undefined;

    const updatedTransaction = { ...existingTransaction, ...transactionData };
    this.transactions.set(id, updatedTransaction);
    return updatedTransaction;
  }

  async deleteTransaction(id: number): Promise<boolean> {
    return this.transactions.delete(id);
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return Array.from(this.transactions.values());
  }

  async getTransactionsByType(type: string): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(transaction => transaction.type === type);
  }

  async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(transaction => {
        const transactionDate = new Date(transaction.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
  }

  // Room booking methods
  async getRoomBooking(id: number): Promise<RoomBooking | undefined> {
    return this.roomBookings.get(id);
  }

  async createRoomBooking(roomBooking: InsertRoomBooking): Promise<RoomBooking> {
    const id = this.roomBookingIdCounter++;
    const newRoomBooking: RoomBooking = { ...roomBooking, id };
    this.roomBookings.set(id, newRoomBooking);
    return newRoomBooking;
  }

  async updateRoomBooking(id: number, roomBookingData: Partial<RoomBooking>): Promise<RoomBooking | undefined> {
    const existingRoomBooking = this.roomBookings.get(id);
    if (!existingRoomBooking) return undefined;

    const updatedRoomBooking = { ...existingRoomBooking, ...roomBookingData };
    this.roomBookings.set(id, updatedRoomBooking);
    return updatedRoomBooking;
  }

  async deleteRoomBooking(id: number): Promise<boolean> {
    return this.roomBookings.delete(id);
  }

  async getAllRoomBookings(): Promise<RoomBooking[]> {
    return Array.from(this.roomBookings.values());
  }

  async getRoomBookingsByRoomId(roomId: number): Promise<RoomBooking[]> {
    return Array.from(this.roomBookings.values())
      .filter(booking => booking.roomId === roomId);
  }

  async getRoomBookingsByDate(date: Date): Promise<RoomBooking[]> {
    const dateString = date.toISOString().split('T')[0];
    return Array.from(this.roomBookings.values())
      .filter(booking => {
        const bookingDate = new Date(booking.date).toISOString().split('T')[0];
        return bookingDate === dateString;
      });
  }

  async getRoomBookingsByDateRange(startDate: Date, endDate: Date): Promise<RoomBooking[]> {
    return Array.from(this.roomBookings.values())
      .filter(booking => {
        const bookingDate = new Date(booking.date);
        return bookingDate >= startDate && bookingDate <= endDate;
      });
  }

  async checkRoomAvailability(roomId: number, date: Date, startTime: string, endTime: string): Promise<boolean> {
    const dateString = date.toISOString().split('T')[0];
    const bookingsOnDate = await this.getRoomBookingsByDate(date);

    // Check if there are any overlapping bookings
    const hasOverlap = bookingsOnDate.some(booking => {
      if (booking.roomId !== roomId) return false;

      const bookingStartTime = booking.startTime;
      const bookingEndTime = booking.endTime;

      // Check for overlap
      return (startTime < bookingEndTime && endTime > bookingStartTime);
    });

    return !hasOverlap;
  }

  // Permission methods
  async getPermission(id: number): Promise<Permission | undefined> {
    return this.permissions.get(id);
  }

  async createPermission(permission: InsertPermission): Promise<Permission> {
    const id = this.permissionIdCounter++;
    const newPermission: Permission = { ...permission, id };
    this.permissions.set(id, newPermission);
    return newPermission;
  }

  async updatePermission(id: number, permissionData: Partial<Permission>): Promise<Permission | undefined> {
    const existingPermission = this.permissions.get(id);
    if (!existingPermission) return undefined;

    const updatedPermission = { ...existingPermission, ...permissionData };
    this.permissions.set(id, updatedPermission);
    return updatedPermission;
  }

  async deletePermission(id: number): Promise<boolean> {
    return this.permissions.delete(id);
  }

  async getAllPermissions(): Promise<Permission[]> {
    return Array.from(this.permissions.values());
  }

  // Role permission methods
  async getRolePermission(id: number): Promise<RolePermission | undefined> {
    return this.rolePermissions.get(id);
  }

  async createRolePermission(rolePermission: InsertRolePermission): Promise<RolePermission> {
    const id = this.rolePermissionIdCounter++;
    const newRolePermission: RolePermission = { ...rolePermission, id };
    this.rolePermissions.set(id, newRolePermission);
    return newRolePermission;
  }

  async updateRolePermission(id: number, rolePermissionData: Partial<RolePermission>): Promise<RolePermission | undefined> {
    const existingRolePermission = this.rolePermissions.get(id);
    if (!existingRolePermission) return undefined;

    const updatedRolePermission = { ...existingRolePermission, ...rolePermissionData };
    this.rolePermissions.set(id, updatedRolePermission);
    return updatedRolePermission;
  }

  async deleteRolePermission(id: number): Promise<boolean> {
    return this.rolePermissions.delete(id);
  }

  async getAllRolePermissions(): Promise<RolePermission[]> {
    return Array.from(this.rolePermissions.values());
  }

  async getRolePermissionsByRole(role: string): Promise<RolePermission[]> {
    return Array.from(this.rolePermissions.values())
      .filter(rp => rp.role === role);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async savePasswordResetToken(userId: number, token: string): Promise<void> {
    // Placeholder:  Replace with persistent token storage
    console.log(`Token ${token} saved for user ${userId}`);
  }
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      createTableIfMissing: true
    });

    // Inicialização adiada de dados padrão para evitar erros de tabela não existente
    setTimeout(() => {
      this.initDefaultData().catch(err => {
        console.error("Erro ao inicializar dados padrão:", err);
      });
    }, 5000); // Aguarda 5 segundos para garantir que as tabelas foram criadas
  }

  private async initDefaultData() {
    // Check if permissions table is empty
    const existingPermissions = await db.select().from(permissions);

    if (existingPermissions.length === 0) {
      // Create default permissions
      const defaultPermissions = [
        { name: "dashboard_view", description: "View dashboard" },
        { name: "appointments_view", description: "View appointments" },
        { name: "appointments_manage", description: "Manage appointments" },
        { name: "psychologists_view", description: "View psychologists" },
        { name: "psychologists_manage", description: "Manage psychologists" },
        { name: "rooms_view", description: "View rooms" },
        { name: "rooms_manage", description: "Manage rooms" },
        { name: "rooms_book", description: "Book rooms" },
        { name: "financial_view", description: "View financial information" },
        { name: "financial_manage", description: "Manage financial information" },
        { name: "permissions_view", description: "View permissions" },
        { name: "permissions_manage", description: "Manage permissions" }
      ];

      for (const permission of defaultPermissions) {
        await this.createPermission({
          name: permission.name,
          description: permission.description
        });
      }
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    return newUser;
  }

  async updateUser(id: number, userData: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // Psychologist methods
  async getPsychologist(id: number): Promise<Psychologist | undefined> {
    const [psychologist] = await db.select().from(psychologists).where(eq(psychologists.id, id));
    return psychologist;
  }

  async getPsychologistByUserId(userId: number): Promise<Psychologist | undefined> {
    const [psychologist] = await db.select().from(psychologists).where(eq(psychologists.userId, userId));
    return psychologist;
  }

  async createPsychologist(psychologist: InsertPsychologist): Promise<Psychologist> {
    const [newPsychologist] = await db.insert(psychologists).values(psychologist).returning();
    return newPsychologist;
  }

  async updatePsychologist(id: number, psychologistData: Partial<Psychologist>): Promise<Psychologist | undefined> {
    const [updatedPsychologist] = await db
      .update(psychologists)
      .set(psychologistData)
      .where(eq(psychologists.id, id))
      .returning();
    return updatedPsychologist;
  }

  async deletePsychologist(id: number): Promise<boolean> {
    const result = await db.delete(psychologists).where(eq(psychologists.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getAllPsychologists(): Promise<Psychologist[]> {
    return await db.select().from(psychologists);
  }

  // Room methods
  async getRoom(id: number): Promise<Room | undefined> {
    const [room] = await db.select().from(rooms).where(eq(rooms.id, id));
    return room;
  }

  async createRoom(room: InsertRoom): Promise<Room> {
    const [newRoom] = await db.insert(rooms).values(room).returning();
    return newRoom;
  }

  async updateRoom(id: number, roomData: Partial<Room>): Promise<Room | undefined> {
    const [updatedRoom] = await db
      .update(rooms)
      .set(roomData)
      .where(eq(rooms.id, id))
      .returning();
    return updatedRoom;
  }

  async deleteRoom(id: number): Promise<boolean> {
    const result = await db.delete(rooms).where(eq(rooms.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getAllRooms(): Promise<Room[]> {
    return await db.select().from(rooms);
  }

  // Appointment methods
  async getAppointment(id: number): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(appointments).where(eq(appointments.id, id));
    return appointment;
  }

  async createAppointment(appointment: InsertAppointment): Promise<Appointment> {
    const [newAppointment] = await db.insert(appointments).values(appointment).returning();
    return newAppointment;
  }

  async updateAppointment(id: number, appointmentData: Partial<Appointment>): Promise<Appointment | undefined> {
    const [updatedAppointment] = await db
      .update(appointments)
      .set(appointmentData)
      .where(eq(appointments.id, id))
      .returning();
    return updatedAppointment;
  }

  async deleteAppointment(id: number): Promise<boolean> {
    const result = await db.delete(appointments).where(eq(appointments.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getAllAppointments(): Promise<Appointment[]> {
    return await db.select().from(appointments);
  }

  async getAppointmentsByPsychologistId(psychologistId: number): Promise<Appointment[]> {
    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.psychologistId, psychologistId));
  }

  async getAppointmentsByDate(date: Date): Promise<Appointment[]> {
    const formattedDate = date.toISOString().split('T')[0];
    return await db
      .select()
      .from(appointments)
      .where(eq(appointments.date, formattedDate));
  }

  async getAppointmentsByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]> {
    return await db
      .select()
      .from(appointments)
      .where(and(
        gte(appointments.date, startDate.toISOString().split('T')[0]),
        lte(appointments.date, endDate.toISOString().split('T')[0])
      ));
  }

  // Transaction methods
  async getTransaction(id: number): Promise<Transaction | undefined> {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [newTransaction] = await db.insert(transactions).values(transaction).returning();
    return newTransaction;
  }

  async updateTransaction(id: number, transactionData: Partial<Transaction>): Promise<Transaction | undefined> {
    const [updatedTransaction] = await db
      .update(transactions)
      .set(transactionData)
      .where(eq(transactions.id, id))
      .returning();
    return updatedTransaction;
  }

  async deleteTransaction(id: number): Promise<boolean> {
    const result = await db.delete(transactions).where(eq(transactions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return await db.select().from(transactions);
  }

  async getTransactionsByType(type: string): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.type, type));
  }

  async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(and(
        gte(transactions.date, startDate.toISOString().split('T')[0]),
        lte(transactions.date, endDate.toISOString().split('T')[0])
      ));
  }

  // Room booking methods
  async getRoomBooking(id: number): Promise<RoomBooking | undefined> {
    const [roomBooking] = await db.select().from(roomBookings).where(eq(roomBookings.id, id));
    return roomBooking;
  }

  async createRoomBooking(roomBooking: InsertRoomBooking): Promise<RoomBooking> {
    const [newRoomBooking] = await db.insert(roomBookings).values(roomBooking).returning();
    return newRoomBooking;
  }

  async updateRoomBooking(id: number, roomBookingData: Partial<RoomBooking>): Promise<RoomBooking | undefined> {
    const [updatedRoomBooking] = await db
      .update(roomBookings)
      .set(roomBookingData)
      .where(eq(roomBookings.id, id))
      .returning();
    return updatedRoomBooking;
  }

  async deleteRoomBooking(id: number): Promise<boolean> {
    const result = await db.delete(roomBookings).where(eq(roomBookings.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getAllRoomBookings(): Promise<RoomBooking[]> {
    return await db.select().from(roomBookings);
  }

  async getRoomBookingsByRoomId(roomId: number): Promise<RoomBooking[]> {
    return await db
      .select()
      .from(roomBookings)
      .where(eq(roomBookings.roomId, roomId));
  }

  async getRoomBookingsByDate(date: Date): Promise<RoomBooking[]> {
    const formattedDate = date.toISOString().split('T')[0];
    return await db
      .select()
      .from(roomBookings)
      .where(eq(roomBookings.date, formattedDate));
  }

  async getRoomBookingsByDateRange(startDate: Date, endDate: Date): Promise<RoomBooking[]> {
    return await db
      .select()
      .from(roomBookings)
      .where(and(
        gte(roomBookings.date, startDate.toISOString().split('T')[0]),
        lte(roomBookings.date, endDate.toISOString().split('T')[0])
      ));
  }

  async checkRoomAvailability(roomId: number, date: Date, startTime: string, endTime: string): Promise<boolean> {
    const formattedDate = date.toISOString().split('T')[0];

    // Get bookings for this room and date
    const bookingsOnDate = await db
      .select()
      .from(roomBookings)
      .where(and(
        eq(roomBookings.roomId, roomId),
        eq(roomBookings.date, formattedDate)
      ));

    // Check for overlapping bookings
    const hasOverlap = bookingsOnDate.some(booking => {
      const bookingStartTime = booking.startTime;
      const bookingEndTime = booking.endTime;

      // Check for overlap
      return (startTime < bookingEndTime && endTime > bookingStartTime);
    });

    return !hasOverlap;
  }

  // Permission methods
  async getPermission(id: number): Promise<Permission | undefined> {
    const [permission] = await db.select().from(permissions).where(eq(permissions.id, id));
    return permission;
  }

  async createPermission(permission: InsertPermission): Promise<Permission> {
    const [newPermission] = await db.insert(permissions).values(permission).returning();
    return newPermission;
  }

  async updatePermission(id: number, permissionData: Partial<Permission>): Promise<Permission | undefined> {
    const [updatedPermission] = await db
      .update(permissions)
      .set(permissionData)
      .where(eq(permissions.id, id))
      .returning();
    return updatedPermission;
  }

  async deletePermission(id: number): Promise<boolean> {
    const result = await db.delete(permissions).where(eq(permissions.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  async getAllPermissions(): Promise<Permission[]> {
    return await db.select().from(permissions);
  }

  // Role permission methods
  async getRolePermission(id: number): Promise<RolePermission | undefined> {
    const [rolePermission] = await db.select().from(rolePermissions).where(eq(rolePermissions.id, id));
    return rolePermission;
  }

  async createRolePermission(rolePermission: InsertRolePermission): Promise<RolePermission> {
    const [newRolePermission] = await db.insert(rolePermissions).values(rolePermission).returning();
    return newRolePermission;
  }

  async updateRolePermission(id: number, rolePermissionData: Partial<RolePermission>): Promise<RolePermission | undefined> {
    const [updatedRolePermission] = await db
      .update(rolePermissions)
      .set(rolePermissionData)
      .where(eq(rolePermissions.id, id))
      .returning();
    return updatedRolePermission;
  }

  async deleteRolePermission(id: number): Promise<boolean> {
    const result = await db.delete(rolePermissions).where(eq(rolePermissions.id, id));
    return result.rowCount ? result.rowCount > 0: false;
  }

  async getAllRolePermissions(): Promise<RolePermission[]> {
    return await db.select().from(rolePermissions);
  }

  async getRolePermissionsByRole(role: string): Promise<RolePermission[]> {
    return await db
      .select()
      .from(rolePermissions)
      .where(eq(rolePermissions.role, role));
  }
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async savePasswordResetToken(userId: number, token: string): Promise<void> {
    // Placeholder implementation. Replace with actual token storage in a database table.
    console.log(`Password reset token '${token}' saved for user ID ${userId}`);
  }
}

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();