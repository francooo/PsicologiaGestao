import express, { type Express, type Request } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertAppointmentSchema, insertRoomSchema, insertPsychologistSchema, insertTransactionSchema, insertRoomBookingSchema, insertPermissionSchema, insertRolePermissionSchema } from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as WhatsAppService from "./services/whatsapp";
import googleCalendarRoutes from "./routes/google-calendar";
import * as GoogleCalendarService from "./services/google-calendar";

// Configure multer for image upload
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage_config = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `profile-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage: storage_config,
  limits: {
    fileSize: 1024 * 1024 * 2, // 2MB max file size
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|gif/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    
    cb(new Error("Apenas imagens nos formatos JPEG, JPG, PNG e GIF são permitidas."));
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // Error handler for Zod validation errors
  const handleZodError = (error: unknown) => {
    if (error instanceof ZodError) {
      const validationError = fromZodError(error);
      return { message: validationError.message };
    }
    return { message: 'An unexpected error occurred' };
  };

  // Psychologists routes
  app.get("/api/psychologists", async (req, res) => {
    try {
      const psychologists = await storage.getAllPsychologists();
      
      // Get associated user details for each psychologist
      const result = await Promise.all(
        psychologists.map(async (psych) => {
          const user = await storage.getUser(psych.userId);
          return {
            ...psych,
            user: user ? {
              id: user.id,
              username: user.username,
              fullName: user.fullName,
              email: user.email,
              role: user.role,
              status: user.status,
              profileImage: user.profileImage
            } : null
          };
        })
      );
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Error fetching psychologists" });
    }
  });

  app.get("/api/psychologists/:id", async (req, res) => {
    try {
      const psychologist = await storage.getPsychologist(parseInt(req.params.id));
      if (!psychologist) {
        return res.status(404).json({ message: "Psychologist not found" });
      }
      
      const user = await storage.getUser(psychologist.userId);
      
      res.json({
        ...psychologist,
        user: user ? {
          id: user.id,
          username: user.username,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
          profileImage: user.profileImage
        } : null
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching psychologist" });
    }
  });

  app.post("/api/psychologists", async (req, res) => {
    try {
      const data = insertPsychologistSchema.parse(req.body);
      const psychologist = await storage.createPsychologist(data);
      res.status(201).json(psychologist);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      res.status(500).json({ message: "Error creating psychologist" });
    }
  });

  app.put("/api/psychologists/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedPsychologist = await storage.updatePsychologist(id, req.body);
      if (!updatedPsychologist) {
        return res.status(404).json({ message: "Psychologist not found" });
      }
      res.json(updatedPsychologist);
    } catch (error) {
      res.status(500).json({ message: "Error updating psychologist" });
    }
  });

  app.delete("/api/psychologists/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.deletePsychologist(id);
      if (!result) {
        return res.status(404).json({ message: "Psychologist not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Error deleting psychologist" });
    }
  });

  // Rooms routes
  app.get("/api/rooms", async (req, res) => {
    try {
      const rooms = await storage.getAllRooms();
      res.json(rooms);
    } catch (error) {
      res.status(500).json({ message: "Error fetching rooms" });
    }
  });

  app.get("/api/rooms/:id", async (req, res) => {
    try {
      const room = await storage.getRoom(parseInt(req.params.id));
      if (!room) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.json(room);
    } catch (error) {
      res.status(500).json({ message: "Error fetching room" });
    }
  });

  app.post("/api/rooms", async (req, res) => {
    try {
      const data = insertRoomSchema.parse(req.body);
      const room = await storage.createRoom(data);
      res.status(201).json(room);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      res.status(500).json({ message: "Error creating room" });
    }
  });

  app.put("/api/rooms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedRoom = await storage.updateRoom(id, req.body);
      if (!updatedRoom) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.json(updatedRoom);
    } catch (error) {
      res.status(500).json({ message: "Error updating room" });
    }
  });

  app.delete("/api/rooms/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.deleteRoom(id);
      if (!result) {
        return res.status(404).json({ message: "Room not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Error deleting room" });
    }
  });

  // Room availability check
  app.get("/api/rooms/availability/:id", async (req, res) => {
    try {
      const roomId = parseInt(req.params.id);
      const date = new Date(req.query.date as string);
      const startTime = req.query.startTime as string;
      const endTime = req.query.endTime as string;
      
      const isAvailable = await storage.checkRoomAvailability(roomId, date, startTime, endTime);
      res.json({ available: isAvailable });
    } catch (error) {
      res.status(500).json({ message: "Error checking room availability" });
    }
  });

  // Appointments routes
  app.get("/api/appointments", async (req, res) => {
    try {
      let appointments;
      
      if (req.query.psychologistId) {
        appointments = await storage.getAppointmentsByPsychologistId(
          parseInt(req.query.psychologistId as string)
        );
      } else if (req.query.date) {
        appointments = await storage.getAppointmentsByDate(
          new Date(req.query.date as string)
        );
      } else if (req.query.startDate && req.query.endDate) {
        appointments = await storage.getAppointmentsByDateRange(
          new Date(req.query.startDate as string),
          new Date(req.query.endDate as string)
        );
      } else {
        appointments = await storage.getAllAppointments();
      }
      
      // Get associated psychologist and room details
      const result = await Promise.all(
        appointments.map(async (appointment) => {
          const psychologist = await storage.getPsychologist(appointment.psychologistId);
          const psychologistUser = psychologist 
            ? await storage.getUser(psychologist.userId) 
            : null;
          
          const room = await storage.getRoom(appointment.roomId);
          
          return {
            ...appointment,
            psychologist: psychologist ? {
              ...psychologist,
              user: psychologistUser ? {
                fullName: psychologistUser.fullName,
                email: psychologistUser.email,
                profileImage: psychologistUser.profileImage
              } : null
            } : null,
            room
          };
        })
      );
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Error fetching appointments" });
    }
  });

  app.get("/api/appointments/:id", async (req, res) => {
    try {
      const appointment = await storage.getAppointment(parseInt(req.params.id));
      if (!appointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      
      const psychologist = await storage.getPsychologist(appointment.psychologistId);
      const psychologistUser = psychologist 
        ? await storage.getUser(psychologist.userId) 
        : null;
      
      const room = await storage.getRoom(appointment.roomId);
      
      res.json({
        ...appointment,
        psychologist: psychologist ? {
          ...psychologist,
          user: psychologistUser ? {
            fullName: psychologistUser.fullName,
            email: psychologistUser.email,
            profileImage: psychologistUser.profileImage
          } : null
        } : null,
        room
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching appointment" });
    }
  });

  app.post("/api/appointments", async (req, res) => {
    try {
      const data = insertAppointmentSchema.parse(req.body);
      
      // Check if room is available for the specified time
      const isRoomAvailable = await storage.checkRoomAvailability(
        data.roomId,
        new Date(data.date),
        data.startTime,
        data.endTime
      );
      
      if (!isRoomAvailable) {
        return res.status(409).json({ message: "Room is not available for the specified time" });
      }
      
      const appointment = await storage.createAppointment(data);
      
      // Also create a room booking
      await storage.createRoomBooking({
        roomId: data.roomId,
        psychologistId: data.psychologistId,
        date: data.date,
        startTime: data.startTime,
        endTime: data.endTime,
        purpose: `Appointment with ${data.patientName}`
      });
      
      res.status(201).json(appointment);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      res.status(500).json({ message: "Error creating appointment" });
    }
  });

  // Helper function to convert time string to minutes for comparison
  function timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  // Handle quick booking from shared WhatsApp links - no authentication required
  app.post("/api/appointments/quick-book", async (req, res) => {
    try {
      const { date, startTime, endTime, patientName, psychologistId, roomId, status, notes } = req.body;
      
      // Validate required fields
      if (!date || !startTime || !endTime || !patientName || !psychologistId) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Check if psychologist exists
      const psychologist = await storage.getPsychologist(parseInt(psychologistId));
      if (!psychologist) {
        return res.status(404).json({ message: "Psychologist not found" });
      }
      
      // Check if room exists and is available
      const isRoomAvailable = await storage.checkRoomAvailability(
        roomId || 1, // Default to room 1 if not specified
        new Date(date),
        startTime,
        endTime
      );
      
      if (!isRoomAvailable) {
        return res.status(409).json({ 
          message: "A sala não está disponível neste horário. Por favor, escolha outro horário." 
        });
      }
      
      // Check for time slot conflicts with the psychologist
      const existingAppointments = await storage.getAppointmentsByDate(date);
      const isTimeSlotTaken = existingAppointments.some(app => {
        // Check if time slots overlap for the same psychologist
        if (app.psychologistId !== parseInt(psychologistId)) return false;
        
        // Convert times to minutes for easier comparison
        const appStart = timeToMinutes(app.startTime);
        const appEnd = timeToMinutes(app.endTime);
        const newStart = timeToMinutes(startTime);
        const newEnd = timeToMinutes(endTime);
        
        // Check for overlap
        return (newStart < appEnd && newEnd > appStart);
      });
      
      if (isTimeSlotTaken) {
        return res.status(409).json({ 
          message: "Este horário já foi agendado. Por favor, escolha outro horário." 
        });
      }
      
      // Create appointment with "pending-confirmation" status
      const appointmentData = {
        date,
        startTime,
        endTime,
        patientName,
        psychologistId: parseInt(psychologistId),
        roomId: roomId || 1, // Default to room 1 if not specified
        status: "pending-confirmation", // Special status for quick bookings
        notes: notes || ""
      };
      
      const appointment = await storage.createAppointment(appointmentData);
      
      // Also create a room booking
      await storage.createRoomBooking({
        roomId: appointmentData.roomId,
        psychologistId: appointmentData.psychologistId,
        date: appointmentData.date,
        startTime: appointmentData.startTime,
        endTime: appointmentData.endTime,
        purpose: `Agendamento online com ${appointmentData.patientName}`
      });
      
      res.status(201).json({ 
        success: true,
        message: "Agendamento enviado com sucesso",
        appointment
      });
    } catch (error) {
      console.error("Error processing quick booking:", error);
      res.status(500).json({ message: "Erro ao processar a solicitação de agendamento" });
    }
  });

  app.put("/api/appointments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedAppointment = await storage.updateAppointment(id, req.body);
      if (!updatedAppointment) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      res.json(updatedAppointment);
    } catch (error) {
      res.status(500).json({ message: "Error updating appointment" });
    }
  });

  app.delete("/api/appointments/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.deleteAppointment(id);
      if (!result) {
        return res.status(404).json({ message: "Appointment not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Error deleting appointment" });
    }
  });

  // Financial transactions routes
  app.get("/api/transactions", async (req, res) => {
    try {
      let transactions;
      
      if (req.query.type) {
        transactions = await storage.getTransactionsByType(req.query.type as string);
      } else if (req.query.startDate && req.query.endDate) {
        transactions = await storage.getTransactionsByDateRange(
          new Date(req.query.startDate as string),
          new Date(req.query.endDate as string)
        );
      } else {
        transactions = await storage.getAllTransactions();
      }
      
      // Get user info for responsible party
      const result = await Promise.all(
        transactions.map(async (transaction) => {
          const responsible = await storage.getUser(transaction.responsibleId);
          
          let relatedAppointment = null;
          if (transaction.relatedAppointmentId) {
            relatedAppointment = await storage.getAppointment(transaction.relatedAppointmentId);
          }
          
          return {
            ...transaction,
            responsible: responsible ? {
              id: responsible.id,
              fullName: responsible.fullName,
              email: responsible.email,
              profileImage: responsible.profileImage
            } : null,
            relatedAppointment
          };
        })
      );
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Error fetching transactions" });
    }
  });

  app.get("/api/transactions/:id", async (req, res) => {
    try {
      const transaction = await storage.getTransaction(parseInt(req.params.id));
      if (!transaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      
      const responsible = await storage.getUser(transaction.responsibleId);
      
      let relatedAppointment = null;
      if (transaction.relatedAppointmentId) {
        relatedAppointment = await storage.getAppointment(transaction.relatedAppointmentId);
      }
      
      res.json({
        ...transaction,
        responsible: responsible ? {
          id: responsible.id,
          fullName: responsible.fullName,
          email: responsible.email,
          profileImage: responsible.profileImage
        } : null,
        relatedAppointment
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching transaction" });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const data = insertTransactionSchema.parse(req.body);
      const transaction = await storage.createTransaction(data);
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      res.status(500).json({ message: "Error creating transaction" });
    }
  });

  app.put("/api/transactions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedTransaction = await storage.updateTransaction(id, req.body);
      if (!updatedTransaction) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.json(updatedTransaction);
    } catch (error) {
      res.status(500).json({ message: "Error updating transaction" });
    }
  });

  app.delete("/api/transactions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.deleteTransaction(id);
      if (!result) {
        return res.status(404).json({ message: "Transaction not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Error deleting transaction" });
    }
  });
  
  // API para gerar dados de exemplo para testes
  app.post("/api/transactions/generate-sample-data", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      
      const user = req.user;
      const today = new Date();
      const lastMonth = new Date(today);
      lastMonth.setMonth(today.getMonth() - 1);
      
      // Mês atual - Receitas
      await storage.createTransaction({
        description: "Consulta - Pedro Santos",
        amount: 150,
        date: new Date().toISOString().split('T')[0],
        type: "income",
        category: "Consulta",
        responsibleId: user.id
      });
      
      await storage.createTransaction({
        description: "Consulta - Maria Oliveira",
        amount: 150,
        date: new Date().toISOString().split('T')[0],
        type: "income",
        category: "Consulta",
        responsibleId: user.id
      });
      
      await storage.createTransaction({
        description: "Avaliação - João Pereira",
        amount: 200,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 5).toISOString().split('T')[0],
        type: "income",
        category: "Avaliação",
        responsibleId: user.id
      });
      
      await storage.createTransaction({
        description: "Workshop de Mindfulness",
        amount: 500,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 10).toISOString().split('T')[0],
        type: "income",
        category: "Workshop",
        responsibleId: user.id
      });
      
      // Mês atual - Despesas
      await storage.createTransaction({
        description: "Aluguel do Consultório",
        amount: 2500,
        date: new Date(today.getFullYear(), today.getMonth(), 5).toISOString().split('T')[0],
        type: "expense",
        category: "Aluguel",
        responsibleId: user.id
      });
      
      await storage.createTransaction({
        description: "Conta de Luz",
        amount: 320,
        date: new Date(today.getFullYear(), today.getMonth(), 7).toISOString().split('T')[0],
        type: "expense",
        category: "Luz",
        responsibleId: user.id
      });
      
      await storage.createTransaction({
        description: "Internet",
        amount: 150,
        date: new Date(today.getFullYear(), today.getMonth(), 8).toISOString().split('T')[0],
        type: "expense",
        category: "Internet",
        responsibleId: user.id
      });
      
      await storage.createTransaction({
        description: "Material de Escritório",
        amount: 230,
        date: new Date(today.getFullYear(), today.getMonth(), 12).toISOString().split('T')[0],
        type: "expense",
        category: "Material de Escritório",
        responsibleId: user.id
      });
      
      // Mês passado - Receitas
      await storage.createTransaction({
        description: "Consulta - Carlos Silva",
        amount: 150,
        date: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 15).toISOString().split('T')[0],
        type: "income",
        category: "Consulta",
        responsibleId: user.id
      });
      
      await storage.createTransaction({
        description: "Consulta - Ana Rodrigues",
        amount: 150,
        date: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 18).toISOString().split('T')[0],
        type: "income",
        category: "Consulta",
        responsibleId: user.id
      });
      
      await storage.createTransaction({
        description: "Sessão em Grupo - Ansiedade",
        amount: 400,
        date: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 22).toISOString().split('T')[0],
        type: "income",
        category: "Sessão em Grupo",
        responsibleId: user.id
      });
      
      // Mês passado - Despesas
      await storage.createTransaction({
        description: "Aluguel do Consultório",
        amount: 2500,
        date: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 5).toISOString().split('T')[0],
        type: "expense",
        category: "Aluguel",
        responsibleId: user.id
      });
      
      await storage.createTransaction({
        description: "Conta de Luz",
        amount: 290,
        date: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 7).toISOString().split('T')[0],
        type: "expense",
        category: "Luz",
        responsibleId: user.id
      });
      
      await storage.createTransaction({
        description: "Internet",
        amount: 150,
        date: new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 9).toISOString().split('T')[0],
        type: "expense",
        category: "Internet",
        responsibleId: user.id
      });
      
      res.status(201).json({ message: "Dados de exemplo criados com sucesso" });
    } catch (error) {
      res.status(500).json({ message: "Erro ao gerar dados de exemplo" });
    }
  });

  // Room bookings routes
  app.get("/api/room-bookings", async (req, res) => {
    try {
      let bookings;
      
      if (req.query.roomId) {
        bookings = await storage.getRoomBookingsByRoomId(parseInt(req.query.roomId as string));
      } else if (req.query.date) {
        bookings = await storage.getRoomBookingsByDate(new Date(req.query.date as string));
      } else if (req.query.startDate && req.query.endDate) {
        bookings = await storage.getRoomBookingsByDateRange(
          new Date(req.query.startDate as string),
          new Date(req.query.endDate as string)
        );
      } else {
        bookings = await storage.getAllRoomBookings();
      }
      
      // Enrich with room and psychologist data
      const result = await Promise.all(
        bookings.map(async (booking) => {
          const room = await storage.getRoom(booking.roomId);
          const psychologist = await storage.getPsychologist(booking.psychologistId);
          const psychologistUser = psychologist 
            ? await storage.getUser(psychologist.userId) 
            : null;
          
          return {
            ...booking,
            room,
            psychologist: psychologist ? {
              ...psychologist,
              user: psychologistUser ? {
                fullName: psychologistUser.fullName,
                email: psychologistUser.email,
                profileImage: psychologistUser.profileImage
              } : null
            } : null
          };
        })
      );
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Error fetching room bookings" });
    }
  });

  app.get("/api/room-bookings/:id", async (req, res) => {
    try {
      const booking = await storage.getRoomBooking(parseInt(req.params.id));
      if (!booking) {
        return res.status(404).json({ message: "Room booking not found" });
      }
      
      const room = await storage.getRoom(booking.roomId);
      const psychologist = await storage.getPsychologist(booking.psychologistId);
      const psychologistUser = psychologist 
        ? await storage.getUser(psychologist.userId) 
        : null;
      
      res.json({
        ...booking,
        room,
        psychologist: psychologist ? {
          ...psychologist,
          user: psychologistUser ? {
            fullName: psychologistUser.fullName,
            email: psychologistUser.email,
            profileImage: psychologistUser.profileImage
          } : null
        } : null
      });
    } catch (error) {
      res.status(500).json({ message: "Error fetching room booking" });
    }
  });

  app.post("/api/room-bookings", async (req, res) => {
    try {
      const data = insertRoomBookingSchema.parse(req.body);
      
      // Check if room is available
      const isRoomAvailable = await storage.checkRoomAvailability(
        data.roomId,
        new Date(data.date),
        data.startTime,
        data.endTime
      );
      
      if (!isRoomAvailable) {
        return res.status(409).json({ message: "Room is not available for the specified time" });
      }
      
      const booking = await storage.createRoomBooking(data);
      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      res.status(500).json({ message: "Error creating room booking" });
    }
  });

  app.put("/api/room-bookings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const updatedBooking = await storage.updateRoomBooking(id, req.body);
      if (!updatedBooking) {
        return res.status(404).json({ message: "Room booking not found" });
      }
      res.json(updatedBooking);
    } catch (error) {
      res.status(500).json({ message: "Error updating room booking" });
    }
  });

  app.delete("/api/room-bookings/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.deleteRoomBooking(id);
      if (!result) {
        return res.status(404).json({ message: "Room booking not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Error deleting room booking" });
    }
  });

  // Permission routes
  app.get("/api/permissions", async (req, res) => {
    try {
      const permissions = await storage.getAllPermissions();
      res.json(permissions);
    } catch (error) {
      res.status(500).json({ message: "Error fetching permissions" });
    }
  });

  app.post("/api/permissions", async (req, res) => {
    try {
      const data = insertPermissionSchema.parse(req.body);
      const permission = await storage.createPermission(data);
      res.status(201).json(permission);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      res.status(500).json({ message: "Error creating permission" });
    }
  });

  // Role permission routes
  app.get("/api/role-permissions", async (req, res) => {
    try {
      let rolePermissions;
      
      if (req.query.role) {
        rolePermissions = await storage.getRolePermissionsByRole(req.query.role as string);
      } else {
        rolePermissions = await storage.getAllRolePermissions();
      }
      
      // Enrich with permission details
      const result = await Promise.all(
        rolePermissions.map(async (rp) => {
          const permission = await storage.getPermission(rp.permissionId);
          return {
            ...rp,
            permission
          };
        })
      );
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ message: "Error fetching role permissions" });
    }
  });

  app.post("/api/role-permissions", async (req, res) => {
    try {
      const data = insertRolePermissionSchema.parse(req.body);
      const rolePermission = await storage.createRolePermission(data);
      res.status(201).json(rolePermission);
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json(handleZodError(error));
      }
      res.status(500).json({ message: "Error creating role permission" });
    }
  });

  app.delete("/api/role-permissions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const result = await storage.deleteRolePermission(id);
      if (!result) {
        return res.status(404).json({ message: "Role permission not found" });
      }
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ message: "Error deleting role permission" });
    }
  });

  // WhatsApp sharing endpoint
  app.post("/api/share/whatsapp", async (req, res) => {
    try {
      const { psychologistId, startDate, endDate, message } = req.body;
      
      if (!psychologistId || !startDate || !endDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Get psychologist info
      const psychologist = await storage.getPsychologist(parseInt(psychologistId));
      if (!psychologist) {
        return res.status(404).json({ message: "Psychologist not found" });
      }
      
      const psychologistUser = await storage.getUser(psychologist.userId);
      if (!psychologistUser) {
        return res.status(404).json({ message: "Psychologist user not found" });
      }
      
      // Get all appointments in date range
      const appointments = await storage.getAppointmentsByDateRange(
        new Date(startDate),
        new Date(endDate)
      );
      
      // Filter by psychologist
      const psychologistAppointments = appointments.filter(
        app => app.psychologistId === parseInt(psychologistId)
      );
      
      // Format message with available slots
      const availableTimes = calculateAvailableSlots(
        new Date(startDate),
        new Date(endDate),
        psychologistAppointments
      );
      
      const whatsappMessage = formatWhatsAppMessage(
        psychologistUser.fullName,
        message || "",
        availableTimes,
        new Date(startDate),
        new Date(endDate),
        parseInt(psychologistId)
      );
      
      // Generate WhatsApp link
      const whatsappLink = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;
      
      res.json({ 
        link: whatsappLink,
        message: whatsappMessage
      });
    } catch (error) {
      res.status(500).json({ message: "Error generating WhatsApp share link" });
    }
  });

  // Generate HttpServer instance
  // User profile management route
  app.post("/api/profile", upload.single("profileImageFile"), async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(400).json({ message: "User ID not found" });
      }

      // Get existing user data
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }

      // Process new data
      const { fullName, email } = req.body;
      const updateData: any = {};

      // Only update fields provided
      if (fullName) updateData.fullName = fullName;
      if (email) updateData.email = email;

      // Process profile image if uploaded
      if (req.file) {
        // If there's an existing profile image, remove it to save space
        if (existingUser.profileImage) {
          try {
            const oldImagePath = path.join(process.cwd(), existingUser.profileImage);
            if (fs.existsSync(oldImagePath)) {
              fs.unlinkSync(oldImagePath);
            }
          } catch (err) {
            console.error("Error deleting old profile image:", err);
          }
        }

        // Save path to uploaded image
        const imageUrl = `/uploads/${req.file.filename}`;
        updateData.profileImage = imageUrl;
      }

      // Update user in database
      const updatedUser = await storage.updateUser(userId, updateData);
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to update user profile" });
      }

      // Return updated user data without sensitive info
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Error updating profile" });
    }
  });

  // Serve uploaded images
  app.use("/uploads", express.static(uploadDir));

  // Password Recovery
  app.post("/api/recover-password", async (req, res) => {
    try {
      const { email } = req.body;
      
      // Buscar usuário pelo email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        // Por segurança, não informamos se o email existe ou não
        return res.status(200).json({ 
          message: "Se o email existir, você receberá as instruções de recuperação."
        });
      }

      // Gerar token único
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Salvar token no banco com expiração
      await storage.savePasswordResetToken(user.id, resetToken);
      
      // Enviar email
      await sendPasswordResetEmail(user, resetToken);
      
      res.status(200).json({ 
        message: "Se o email existir, você receberá as instruções de recuperação."
      });
    } catch (error) {
      console.error('Error in password recovery:', error);
      res.status(500).json({ message: "Erro ao processar recuperação de senha" });
    }
  });

  // Endpoint para agendamento rápido via WhatsApp
  app.post("/api/appointments/quick-book", async (req, res) => {
    try {
      const appointmentData = req.body;
      
      // Validar dados básicos
      if (!appointmentData.date || !appointmentData.startTime || !appointmentData.endTime || 
          !appointmentData.patientName || !appointmentData.psychologistId) {
        return res.status(400).json({ message: "Dados incompletos para agendamento" });
      }
      
      // Adicionar status especial para agendamentos via WhatsApp
      const newAppointment = await storage.createAppointment({
        ...appointmentData,
        status: "pending-confirmation", // Status especial para agendamentos via WhatsApp
      });
      
      res.status(201).json(newAppointment);
    } catch (error) {
      console.error("Erro no agendamento rápido:", error);
      res.status(500).json({ message: "Erro ao processar agendamento" });
    }
  });

  // WhatsApp Integration
  app.post("/api/whatsapp/share-availability", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { 
        phoneNumber, 
        psychologistId, 
        startDate, 
        endDate, 
        customMessage 
      } = req.body;
      
      if (!phoneNumber || !psychologistId || !startDate || !endDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      
      // Verificar se o psicólogo existe
      const psychologist = await storage.getPsychologist(parseInt(psychologistId));
      if (!psychologist) {
        return res.status(404).json({ message: "Psychologist not found" });
      }
      
      // Obter usuário associado ao psicólogo para pegar o nome
      const psychologistUser = await storage.getUser(psychologist.userId);
      if (!psychologistUser) {
        return res.status(404).json({ message: "Psychologist user not found" });
      }
      
      // Converter datas
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Obter compromissos no período para verificar disponibilidade
      const appointments = await storage.getAppointmentsByDateRange(start, end);
      const psychologistAppointments = appointments.filter(app => app.psychologistId === parseInt(psychologistId));
      
      // Calcular slots disponíveis
      const availableTimes = calculateAvailableSlots(start, end, psychologistAppointments, psychologist);
      
      // Gerar a mensagem com links para o Google Calendar
      const message = await formatWhatsAppMessage(
        psychologistUser.fullName,
        customMessage || "",
        availableTimes,
        start,
        end,
        parseInt(psychologistId),
        psychologist.userId // Usuário do psicólogo para criar eventos no Google Calendar
      );
      
      // Enviar via WhatsApp
      const result = await WhatsAppService.sendWhatsAppAvailability(
        phoneNumber,
        message
      );
      
      res.json({ 
        success: true, 
        message: "Availability with Google Calendar links shared successfully", 
        result 
      });
    } catch (error) {
      console.error("Error sharing availability via WhatsApp:", error);
      res.status(500).json({ 
        message: "Error sharing availability", 
        error: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  // Google Calendar routes
  app.use("/api/google-calendar", googleCalendarRoutes);

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to calculate available time slots
function calculateAvailableSlots(
  startDate: Date,
  endDate: Date,
  appointments: any[],
  psychologist?: any
): { date: string, slots: string[] }[] {
  const availableTimes: { date: string, slots: string[] }[] = [];
  const workingHours = {
    start: "08:00",
    end: "18:00"
  };
  const slotDuration = 60; // minutes
  
  // Get all dates between start and end date
  const dates = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) { // Skip weekends
      dates.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  // For each date, calculate available slots
  dates.forEach(date => {
    const dateString = date.toISOString().split('T')[0];
    const dateAppointments = appointments.filter(app => {
      const appDate = new Date(app.date).toISOString().split('T')[0];
      return appDate === dateString;
    });
    
    // Calculate busy times
    const busyTimes = dateAppointments.map(app => ({
      start: app.startTime,
      end: app.endTime
    }));
    
    // Calculate available slots
    const slots = calculateTimeSlots(workingHours.start, workingHours.end, slotDuration, busyTimes);
    
    availableTimes.push({
      date: dateString,
      slots
    });
  });
  
  return availableTimes;
}

// Helper function to calculate time slots
function calculateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number,
  busySlots: { start: string, end: string }[]
): string[] {
  const availableSlots: string[] = [];
  
  let currentTime = new Date(`2000-01-01T${startTime}`);
  const endTimeDate = new Date(`2000-01-01T${endTime}`);
  
  while (currentTime < endTimeDate) {
    const currentTimeStr = currentTime.toTimeString().substring(0, 5);
    
    // Add duration to get the end time of this slot
    const slotEndTime = new Date(currentTime.getTime() + durationMinutes * 60000);
    const slotEndTimeStr = slotEndTime.toTimeString().substring(0, 5);
    
    // Check if this slot overlaps with any busy slots
    const isAvailable = !busySlots.some(busy => {
      return (currentTimeStr < busy.end && slotEndTimeStr > busy.start);
    });
    
    if (isAvailable) {
      availableSlots.push(`${currentTimeStr} - ${slotEndTimeStr}`);
    }
    
    // Move to next slot
    currentTime = slotEndTime;
  }
  
  return availableSlots;
}

// Helper function to format WhatsApp message with Google Calendar links
async function formatWhatsAppMessage(
  psychologistName: string,
  customMessage: string,
  availableTimes: { date: string, slots: string[] }[],
  startDate: Date,
  endDate: Date,
  psychologistId: number,
  psychologistUserId: number
): Promise<string> {
  const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
  
  let message = customMessage.trim() ? customMessage + "\n\n" : "";
  
  message += `*Horários disponíveis - ${psychologistName}*\n`;
  message += `Período: ${dateFormatter.format(startDate)} a ${dateFormatter.format(endDate)}\n\n`;
  
  // Processar cada dia disponível
  for (const item of availableTimes) {
    const date = new Date(item.date);
    const formattedDate = dateFormatter.format(date);
    message += `*${formattedDate} (${getDayOfWeek(date)})*\n`;
    
    if (item.slots.length === 0) {
      message += "Sem horários disponíveis neste dia.\n";
    } else {
      // Processar cada slot de horário
      for (const slot of item.slots) {
        // Extrair horas de início e fim
        const [startTime, endTime] = slot.split(" - ");
        
        // Criar evento no Google Calendar e obter o link
        const eventData = {
          summary: `Consulta com ${psychologistName}`,
          date: item.date,
          startTime,
          endTime,
          details: `Horário disponível para agendamento com ${psychologistName}. Clique para confirmar.`
        };
        
        try {
          // Usar o link fixo de agendamento do Google Calendar
          const googleCalendarLink = GoogleCalendarService.getAppointmentSchedulingLink(
            psychologistUserId, 
            eventData
          );
          
          // Usar o link do Google Calendar para agendamento
          message += `- ${slot} 👉 [Agendar via Google Calendar](${googleCalendarLink})\n`;
        } catch (error) {
          console.error(`Erro ao criar evento no Google Calendar: ${error}`);
          // Fallback para o link interno
          const encodedDate = encodeURIComponent(item.date);
          const encodedTime = encodeURIComponent(slot);
          const encodedPsychologistId = encodeURIComponent(psychologistId.toString());
          
          const baseUrl = process.env.BASE_URL || "https://management-consultancy-psi.replit.app";
          const bookingLink = `${baseUrl}/quick-booking?date=${encodedDate}&time=${encodedTime}&psychologist=${encodedPsychologistId}`;
          
          message += `- ${slot} 👉 [Agendar](${bookingLink})\n`;
        }
      }
    }
    message += "\n";
  }
  
  message += "Clique nos links para agendar diretamente ou entre em contato para mais informações.";
  
  return message;
}

// Helper function to get day of week in Portuguese
function getDayOfWeek(date: Date): string {
  const days = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
  return days[date.getDay()];
}
