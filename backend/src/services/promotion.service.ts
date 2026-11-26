import { readFileSync } from 'fs';
import { Readable } from 'stream';
import csv from 'csv-parser';
import * as XLSX from 'xlsx';
import { AppDataSource } from '../database/data-source';
import { Promotion, User } from '../entities/Entities';
import { PasswordService } from '../utils/password.service';
import { EmailService } from '../utils/email.service';
import { HttpError, badRequest, conflict } from '../utils/http-error';
import { findOwnedPromotion } from './access.service';

export interface StudentInput {
  email?: string;
  firstName?: string;
  lastName?: string;
}

export interface EnrollmentSummary {
  totalProcessed: number;
  newStudents: number;
  existingStudents: number;
  errors: string[];
}

const MAX_STUDENTS_PER_REQUEST = 500;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMAIL_HEADERS = ['email', 'e-mail', 'mail'];
const FIRST_NAME_HEADERS = ['prenom', 'firstname', 'first_name'];
const LAST_NAME_HEADERS = ['nom', 'lastname', 'last_name'];

const promotions = () => AppDataSource.getRepository(Promotion);
const users = () => AppDataSource.getRepository(User);

const normalizeHeader = (header: string) =>
  header.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function pickColumn(row: Record<string, unknown>, names: string[]): string | undefined {
  for (const [key, value] of Object.entries(row)) {
    if (names.includes(normalizeHeader(key)) && value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return undefined;
}

function toStudentInput(row: Record<string, unknown>): StudentInput {
  return {
    email: pickColumn(row, EMAIL_HEADERS),
    firstName: pickColumn(row, FIRST_NAME_HEADERS),
    lastName: pickColumn(row, LAST_NAME_HEADERS),
  };
}

function parseCsv(filePath: string): Promise<StudentInput[]> {
  const text = readFileSync(filePath, 'utf8').replace(/^﻿/, '');
  // Les exports Excel français utilisent le point-virgule.
  const header = text.split(/\r?\n/, 1)[0];
  const separator = header.split(';').length > header.split(',').length ? ';' : ',';

  return new Promise((resolve, reject) => {
    const rows: StudentInput[] = [];
    Readable.from([text]).pipe(csv({ separator }))
      .on('data', (row: Record<string, unknown>) => rows.push(toStudentInput(row)))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

function parseSpreadsheet(filePath: string): StudentInput[] {
  const sheet = XLSX.readFile(filePath, { sheetRows: MAX_STUDENTS_PER_REQUEST + 1 });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet.Sheets[sheet.SheetNames[0]], { defval: '' });
  return rows.map(toStudentInput);
}

function parseJson(filePath: string): StudentInput[] {
  const data = JSON.parse(readFileSync(filePath, 'utf8'));
  if (!Array.isArray(data)) throw badRequest('Le fichier JSON doit contenir un tableau d\'étudiants');
  return data.filter(item => item && typeof item === 'object').map(toStudentInput);
}

async function parseStudentFile(file: Express.Multer.File): Promise<StudentInput[]> {
  const extension = file.originalname.split('.').pop()?.toLowerCase();
  try {
    if (extension === 'csv') return await parseCsv(file.path);
    if (extension === 'xlsx' || extension === 'xls') return parseSpreadsheet(file.path);
    if (extension === 'json') return parseJson(file.path);
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw badRequest('Fichier illisible ou mal formé');
  }
  throw badRequest('Format de fichier non pris en charge');
}

export class PromotionService {
  private emailService = new EmailService();

  createPromotion(teacherId: number, data: { name: string; description?: string; year: number }): Promise<Promotion> {
    return promotions().save(promotions().create({
      name: data.name.trim(),
      description: data.description,
      year: Number(data.year),
      teacher: { id: teacherId },
    }));
  }

  async updatePromotion(id: number, teacherId: number, data: { name?: string; description?: string; year?: number }): Promise<Promotion> {
    const promotion = await findOwnedPromotion(id, teacherId, ['students']);
    if (data.name !== undefined) promotion.name = data.name.trim();
    if (data.description !== undefined) promotion.description = data.description;
    if (data.year !== undefined) promotion.year = Number(data.year);
    return promotions().save(promotion);
  }

  /** Les comptes étudiants sont conservés ; une promotion qui a des projets ne se supprime pas. */
  async deletePromotion(id: number, teacherId: number): Promise<void> {
    const promotion = await findOwnedPromotion(id, teacherId, ['projects']);
    if (promotion.projects?.length) throw conflict('Cette promotion contient des projets : supprimez-les d’abord.');
    await promotions().remove(promotion);
  }

  async removeStudent(promotionId: number, teacherId: number, studentId: number): Promise<Promotion> {
    const promotion = await findOwnedPromotion(promotionId, teacherId, ['students']);
    promotion.students = promotion.students.filter(student => student.id !== studentId);
    return promotions().save(promotion);
  }

  getPromotionsByTeacher(teacherId: number): Promise<Promotion[]> {
    return promotions().find({
      where: { teacher: { id: teacherId } },
      relations: ['students', 'projects'],
      order: { year: 'DESC', name: 'ASC' },
    });
  }

  async addStudents(promotionId: number, teacherId: number, students: StudentInput[]): Promise<{ promotion: Promotion; summary: EnrollmentSummary }> {
    if (students.length > MAX_STUDENTS_PER_REQUEST) throw badRequest(`${MAX_STUDENTS_PER_REQUEST} étudiants maximum par requête`);
    const promotion = await findOwnedPromotion(promotionId, teacherId, ['students']);
    const summary: EnrollmentSummary = { totalProcessed: 0, newStudents: 0, existingStudents: 0, errors: [] };
    const seen = new Set<string>();
    const emails: Promise<void>[] = [];

    for (const [index, input] of students.entries()) {
      summary.totalProcessed++;
      const email = input.email?.trim().toLowerCase();
      if (!email || !EMAIL_PATTERN.test(email)) {
        summary.errors.push(`Ligne ${index + 1} : adresse email manquante ou invalide`);
        continue;
      }
      if (seen.has(email)) {
        summary.errors.push(`Ligne ${index + 1} : adresse en double (${email})`);
        continue;
      }
      seen.add(email);

      let student = await users().findOne({ where: { email } });
      if (student && student.role !== 'student') {
        summary.errors.push(`Ligne ${index + 1} : ${email} est un compte enseignant`);
        continue;
      }
      if (student) {
        summary.existingStudents++;
      } else {
        student = await this.createStudentAccount(email, input, summary, emails);
        summary.newStudents++;
      }
      if (!promotion.students.some(member => member.id === student!.id)) promotion.students.push(student);
    }

    const saved = await promotions().save(promotion);
    await Promise.all(emails);
    return { promotion: saved, summary };
  }

  async importStudents(promotionId: number, teacherId: number, file: Express.Multer.File) {
    await findOwnedPromotion(promotionId, teacherId);
    const rows = await parseStudentFile(file);
    if (rows.length === 0) throw badRequest('Aucun étudiant trouvé dans le fichier');
    return this.addStudents(promotionId, teacherId, rows);
  }

  private async createStudentAccount(email: string, input: StudentInput, summary: EnrollmentSummary, emails: Promise<void>[]): Promise<User> {
    const tempPassword = PasswordService.generateTemporaryPassword();
    const student = await users().save(users().create({
      email,
      firstName: input.firstName?.trim() || this.firstNameFromEmail(email),
      lastName: input.lastName?.trim() || '',
      role: 'student',
      password: await PasswordService.hashPassword(tempPassword),
    }));
    emails.push(this.emailService.sendAccountCreationEmail(email, student.firstName, tempPassword).then(
      () => undefined,
      () => { summary.errors.push(`Email de bienvenue non envoyé à ${email} (utiliser « Mot de passe oublié »)`); },
    ));
    return student;
  }

  private firstNameFromEmail(email: string): string {
    const name = email.split('@')[0].split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  }
}
