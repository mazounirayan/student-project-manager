import { body, validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

export const handleValidationErrors = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const [first] = errors.array();
  res.status(400).json({
    error: String(first.msg),
    details: errors.array().map(e => ({ field: 'path' in e ? e.path : undefined, message: String(e.msg) })),
  });
};

const required = (field: string, label: string) =>
  body(field).isString().trim().notEmpty().withMessage(`${label} requis`);

const optionalText = (field: string, label: string) =>
  body(field).optional({ values: 'null' }).isString().withMessage(`${label} invalide`);

const positiveNumber = (field: string, label: string) =>
  body(field).isFloat({ gt: 0 }).withMessage(`${label} doit être un nombre positif`);

// ----- Authentification -----

const passwordRule = (field: string) =>
  body(field)
    .isString().isLength({ min: 8, max: 128 }).withMessage('Le mot de passe doit contenir entre 8 et 128 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Le mot de passe doit contenir une minuscule, une majuscule et un chiffre');

export const validateLogin = [
  body('email').isString().isEmail().withMessage('Adresse email invalide'),
  body('password').isString().notEmpty().withMessage('Mot de passe requis'),
  handleValidationErrors,
];

export const validateRegister = [
  body('email').isString().isEmail().withMessage('Adresse email invalide'),
  passwordRule('password'),
  required('firstName', 'Prénom'),
  required('lastName', 'Nom'),
  handleValidationErrors,
];

export const validateForgotPassword = [
  body('email').isString().isEmail().withMessage('Adresse email invalide'),
  handleValidationErrors,
];

export const validateResetPassword = [
  body('token').isString().notEmpty().withMessage('Jeton de réinitialisation requis'),
  passwordRule('newPassword'),
  handleValidationErrors,
];

export const validateRefreshToken = [
  body('refreshToken').isString().notEmpty().withMessage('Jeton de rafraîchissement requis'),
  handleValidationErrors,
];

export const validateOAuthToken = [
  body('token').isString().notEmpty().withMessage('Jeton OAuth requis'),
  handleValidationErrors,
];

export const validateProfileUpdate = [
  body('firstName').optional().isString().trim().notEmpty().withMessage('Prénom invalide'),
  body('lastName').optional().isString().trim().notEmpty().withMessage('Nom invalide'),
  handleValidationErrors,
];

// ----- Promotions et projets -----

export const validatePromotion = (partial: boolean) => [
  partial ? body('name').optional().isString().trim().notEmpty().withMessage('Nom de promotion invalide')
          : required('name', 'Nom de la promotion'),
  optionalText('description', 'Description'),
  (partial ? body('year').optional() : body('year')).isInt({ min: 2000, max: 2100 }).withMessage('Année invalide'),
  handleValidationErrors,
];

export const validateProject = (partial: boolean) => {
  const field = (name: string) => (partial ? body(name).optional() : body(name));
  return [
    field('name').isString().trim().notEmpty().withMessage('Nom du projet requis'),
    field('description').isString().trim().notEmpty().withMessage('Description du projet requise'),
    field('promotionId').isInt({ min: 1 }).withMessage('Promotion invalide'),
    body('status').optional().isIn(['draft', 'visible']).withMessage('Statut invalide'),
    body('minGroupSize').optional({ values: 'null' }).isInt({ min: 0 }).withMessage('Taille minimale de groupe invalide'),
    body('maxGroupSize').optional({ values: 'null' }).isInt({ min: 0 }).withMessage('Taille maximale de groupe invalide'),
    body('groupFormationRule').optional({ values: 'null' }).isIn(['manual', 'random', 'free']).withMessage('Mode de formation des groupes invalide'),
    body('groupFormationDeadline').optional({ values: 'falsy' }).isISO8601().withMessage('Date limite de formation des groupes invalide'),
    handleValidationErrors,
  ];
};

export const validateGrouping = [
  body('groups').isArray({ max: 200 }).withMessage('Le champ "groups" doit être un tableau'),
  body('groups.*.id').isInt().withMessage('Identifiant de groupe invalide'),
  body('groups.*.memberIds').isArray({ max: 500 }).withMessage('"memberIds" doit être un tableau'),
  body('groups.*.memberIds.*').isInt({ min: 1 }).withMessage('Identifiant de membre invalide'),
  handleValidationErrors,
];

// ----- Livrables -----

export const validateDeliverable = (partial: boolean) => {
  const field = (name: string) => (partial ? body(name).optional() : body(name));
  return [
    field('name').isString().trim().notEmpty().withMessage('Nom du livrable requis'),
    field('description').isString().withMessage('Description du livrable requise'),
    field('type').isIn(['archive', 'git_link']).withMessage('Type de livrable invalide'),
    field('deadline').isISO8601().withMessage('Date limite invalide'),
    partial ? body('projectId').optional() : body('projectId').isInt({ min: 1 }).withMessage('Projet invalide'),
    body('allowLateSubmission').optional().isBoolean().withMessage('"allowLateSubmission" doit être un booléen'),
    body('penaltyPerHour').optional().isInt({ min: 0 }).withMessage('Pénalité par heure invalide'),
    handleValidationErrors,
  ];
};

export const validateRule = (partial: boolean) => [
  (partial ? body('type').optional() : body('type')).isIn(['max_size', 'file_presence', 'folder_structure', 'file_content']).withMessage('Type de règle invalide'),
  (partial ? body('configuration').optional() : body('configuration')).custom(value => typeof value === 'string' || (typeof value === 'object' && value !== null && !Array.isArray(value)))
    .withMessage('Configuration de règle invalide'),
  optionalText('errorMessage', 'Message d\'erreur'),
  handleValidationErrors,
];

// ----- Soutenances -----

export const validateDefenseSchedule = [
  body('startDateTime').isISO8601().withMessage('Date de début invalide'),
  body('endDateTime').optional({ values: 'null' }).isISO8601().withMessage('Date de fin invalide'),
  body('durationPerGroup').optional({ values: 'null' }).isInt({ min: 5, max: 480 }).withMessage('Durée par groupe invalide (5 à 480 minutes)'),
  optionalText('location', 'Lieu'),
  handleValidationErrors,
];

export const validateDefenseOrder = [
  body('newOrder').isArray({ min: 1, max: 200 }).withMessage('"newOrder" doit être un tableau non vide'),
  body('newOrder.*.groupId').isInt({ min: 1 }).withMessage('Identifiant de groupe invalide'),
  body('newOrder.*.orderIndex').isInt({ min: 1 }).withMessage('Ordre de passage invalide'),
  handleValidationErrors,
];

// ----- Notation -----

const GRID_TYPES = ['deliverable', 'report', 'defense'];

export const validateGrid = (partial: boolean) => {
  const field = (name: string) => (partial ? body(name).optional() : body(name));
  return [
    field('name').isString().trim().notEmpty().withMessage('Nom de la grille requis'),
    field('type').isIn(GRID_TYPES).withMessage('Type de grille invalide'),
    partial ? body('projectId').optional() : body('projectId').isInt({ min: 1 }).withMessage('Projet invalide'),
    body('weight').optional().isFloat({ min: 0 }).withMessage('Pondération invalide'),
    optionalText('description', 'Description'),
    body('deliverableId').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Livrable invalide'),
    handleValidationErrors,
  ];
};

export const validateCriterion = (partial: boolean) => [
  partial ? body('name').optional().isString().trim().notEmpty().withMessage('Nom du critère invalide') : required('name', 'Nom du critère'),
  partial ? body('maxScore').optional().isFloat({ gt: 0 }).withMessage('Note maximale invalide') : positiveNumber('maxScore', 'Note maximale'),
  body('weight').optional().isFloat({ gt: 0 }).withMessage('Pondération invalide'),
  body('type').optional().isIn(['group', 'individual']).withMessage('Type de critère invalide'),
  body('hasComments').optional().isBoolean().withMessage('"hasComments" doit être un booléen'),
  optionalText('description', 'Description'),
  handleValidationErrors,
];

export const validateSession = [
  body('gridId').optional().isInt({ min: 1 }).withMessage('Grille invalide'),
  body('groupId').optional().isInt({ min: 1 }).withMessage('Groupe invalide'),
  body('entries').isArray({ max: 200 }).withMessage('"entries" doit être un tableau'),
  body('entries.*.criterionId').isInt({ min: 1 }).withMessage('Critère invalide'),
  body('entries.*.score').isFloat({ min: 0 }).withMessage('Note invalide'),
  body('entries.*.comment').optional({ values: 'null' }).isString().isLength({ max: 5000 }).withMessage('Commentaire invalide'),
  body('globalComment').optional({ values: 'null' }).isString().isLength({ max: 10000 }).withMessage('Commentaire global invalide'),
  body('status').optional().isIn(['draft', 'submitted', 'validated']).withMessage('Statut de notation invalide'),
  handleValidationErrors,
];

export const validateWeights = [
  body('weights').isArray({ min: 1, max: 100 }).withMessage('"weights" doit être un tableau non vide'),
  body('weights.*.weight').isFloat({ min: 0 }).withMessage('Pondération invalide'),
  handleValidationErrors,
];

export const validateGradesValidation = [
  body('projectId').isInt({ min: 1 }).withMessage('Projet invalide'),
  handleValidationErrors,
];

// ----- Rapports -----

export const validateReportCreation = [
  body('projectId').isInt({ min: 1 }).withMessage('Projet invalide'),
  body('groupId').isInt({ min: 1 }).withMessage('Groupe invalide'),
  body('title').optional().isString().trim().notEmpty().isLength({ max: 255 }).withMessage('Titre invalide'),
  handleValidationErrors,
];

export const validateReportConfig = [
  body('isEnabled').optional().isBoolean().withMessage('"isEnabled" doit être un booléen'),
  body('format').optional().isIn(['markdown', 'html']).withMessage('Format de rapport invalide'),
  body('deadline').optional({ values: 'null' }).isISO8601().withMessage('Date limite invalide'),
  optionalText('instructions', 'Consignes'),
  body('sections').optional().isArray({ max: 50 }).withMessage('"sections" doit être un tableau'),
  body('sections.*.title').isString().trim().notEmpty().withMessage('Titre de section requis'),
  body('sections.*.description').optional({ values: 'null' }).isString().withMessage('Description de section invalide'),
  body('sections.*.required').optional().isBoolean().withMessage('"required" doit être un booléen'),
  body('sections.*.wordLimit').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Limite de mots invalide'),
  handleValidationErrors,
];

export const validateSectionConfig = [
  body('title').optional().isString().trim().notEmpty().withMessage('Titre de section invalide'),
  body('description').optional({ values: 'null' }).isString().withMessage('Description de section invalide'),
  body('required').optional().isBoolean().withMessage('"required" doit être un booléen'),
  body('wordLimit').optional({ values: 'null' }).isInt({ min: 1 }).withMessage('Limite de mots invalide'),
  handleValidationErrors,
];

export const validateSectionContent = [
  body('groupId').isInt({ min: 1 }).withMessage('Groupe invalide'),
  body('content').isString().isLength({ max: 200_000 }).withMessage('Contenu invalide ou trop long'),
  handleValidationErrors,
];
