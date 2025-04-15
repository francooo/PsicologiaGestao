import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

// Escopo necessário para ler e escrever eventos no calendário
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

// Credenciais OAuth2
const oauth2Client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Gerencia os tokens de acesso por usuário
const userTokens: Record<number, any> = {};

/**
 * Gera uma URL de autorização para o usuário conectar sua conta Google
 */
export function getAuthUrl(userId: number): string {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    state: userId.toString(), // Usado para identificar o usuário após a autorização
    prompt: 'consent' // Sempre solicita permissão (necessário para obter refresh_token)
  });
  
  return authUrl;
}

/**
 * Processa o código de autorização e salva os tokens do usuário
 */
export async function handleAuthCode(code: string, userId: number): Promise<boolean> {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    
    // Armazena os tokens para uso futuro
    userTokens[userId] = tokens;
    
    // Aqui você poderia salvar os tokens no banco de dados para uso persistente
    // await db.insert(userGoogleTokens).values({
    //   userId,
    //   accessToken: tokens.access_token,
    //   refreshToken: tokens.refresh_token,
    //   expiryDate: tokens.expiry_date
    // });
    
    return true;
  } catch (error) {
    console.error('Erro ao processar o código de autorização:', error);
    return false;
  }
}

/**
 * Configura o cliente OAuth2 com os tokens do usuário
 */
function setupClientForUser(userId: number): calendar_v3.Calendar | null {
  const tokens = userTokens[userId];
  
  if (!tokens) {
    return null;
  }
  
  oauth2Client.setCredentials(tokens);
  
  // Criar um cliente da API do Calendar
  return google.calendar({ version: 'v3', auth: oauth2Client });
}

/**
 * Adiciona um evento ao Google Calendar do usuário
 */
export async function addEventToCalendar(
  userId: number,
  event: {
    summary: string;
    description: string;
    location?: string;
    startDateTime: string; // formato ISO
    endDateTime: string;   // formato ISO
    attendees?: Array<{ email: string }>;
  }
): Promise<string | null> {
  const calendar = setupClientForUser(userId);
  
  if (!calendar) {
    return null;
  }
  
  try {
    const response = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: event.summary,
        description: event.description,
        location: event.location,
        start: {
          dateTime: event.startDateTime,
          timeZone: 'America/Sao_Paulo', // Ajuste para seu fuso horário
        },
        end: {
          dateTime: event.endDateTime,
          timeZone: 'America/Sao_Paulo', // Ajuste para seu fuso horário
        },
        attendees: event.attendees,
        reminders: {
          useDefault: true,
        },
      },
    });
    
    return response.data.id || null;
  } catch (error) {
    console.error('Erro ao adicionar evento ao calendário:', error);
    return null;
  }
}

/**
 * Atualiza um evento no Google Calendar do usuário
 */
export async function updateCalendarEvent(
  userId: number,
  eventId: string,
  event: {
    summary?: string;
    description?: string;
    location?: string;
    startDateTime?: string;
    endDateTime?: string;
    attendees?: Array<{ email: string }>;
  }
): Promise<boolean> {
  const calendar = setupClientForUser(userId);
  
  if (!calendar) {
    return false;
  }
  
  try {
    // Primeiro, obter o evento atual
    const currentEvent = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });
    
    // Preparar o corpo da solicitação
    const requestBody: any = {
      ...currentEvent.data,
      summary: event.summary ?? currentEvent.data.summary,
      description: event.description ?? currentEvent.data.description,
      location: event.location ?? currentEvent.data.location,
    };
    
    // Atualizar horários, se fornecidos
    if (event.startDateTime) {
      requestBody.start = {
        dateTime: event.startDateTime,
        timeZone: 'America/Sao_Paulo',
      };
    }
    
    if (event.endDateTime) {
      requestBody.end = {
        dateTime: event.endDateTime,
        timeZone: 'America/Sao_Paulo',
      };
    }
    
    // Atualizar attendees, se fornecidos
    if (event.attendees) {
      requestBody.attendees = event.attendees;
    }
    
    await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      requestBody: requestBody,
    });
    
    return true;
  } catch (error) {
    console.error('Erro ao atualizar evento no calendário:', error);
    return false;
  }
}

/**
 * Remove um evento do Google Calendar do usuário
 */
export async function deleteCalendarEvent(userId: number, eventId: string): Promise<boolean> {
  const calendar = setupClientForUser(userId);
  
  if (!calendar) {
    return false;
  }
  
  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
    });
    
    return true;
  } catch (error) {
    console.error('Erro ao remover evento do calendário:', error);
    return false;
  }
}

/**
 * Lista os próximos eventos do calendário do usuário
 */
export async function listUpcomingEvents(userId: number, maxResults = 10): Promise<any[] | null> {
  const calendar = setupClientForUser(userId);
  
  if (!calendar) {
    return null;
  }
  
  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: new Date().toISOString(),
      maxResults: maxResults,
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    return response.data.items || [];
  } catch (error) {
    console.error('Erro ao listar eventos do calendário:', error);
    return null;
  }
}

/**
 * Verifica se o usuário está autenticado com o Google Calendar
 */
export function isUserAuthenticated(userId: number): boolean {
  return !!userTokens[userId];
}