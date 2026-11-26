import type { DemoDb } from "./types"

const DAY = 86_400_000

// Heures rondes : les échéances fictives tombent à l’heure pile.
function iso(offsetMs: number): string {
  const date = new Date(Date.now() + offsetMs)
  date.setMinutes(0, 0, 0)
  return date.toISOString()
}

/**
 * Base de démonstration fictive : une promotion, deux projets, trois groupes,
 * des livrables rendus / en retard / à rendre, une soutenance planifiée et des notes.
 * Toutes les dates sont relatives au chargement pour rester cohérentes.
 */
export function buildDemoDb(): DemoDb {
  const now = Date.now()

  // --- Comptes (fictifs, domaine @demo.example) ---
  const teacher = { id: 1, email: "camille.fabre@demo.example", firstName: "Camille", lastName: "Fabre", role: "teacher" as const }
  const studentNames: Array<[string, string]> = [
    ["Alex", "Moret"],
    ["Brice", "Lemaire"],
    ["Chloé", "Nguyen"],
    ["Diego", "Pereira"],
    ["Emma", "Roussel"],
    ["Farid", "Bouchard"],
    ["Gabriel", "Fontaine"],
    ["Hana", "Belkacem"],
  ]
  const students = studentNames.map(([firstName, lastName], i) => ({
    id: 10 + i,
    email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@demo.example`,
    firstName,
    lastName,
    role: "student" as const,
  }))
  const users = [teacher, ...students].map((u) => ({ ...u, isActive: true, createdAt: iso(-90 * DAY) }))

  const studentIds = students.map((s) => s.id)

  const promotion = {
    id: 1,
    name: "Master 1 Informatique — Promotion 2026",
    description: "Promotion de démonstration : parcours génie logiciel et données.",
    year: 2026,
    teacherId: teacher.id,
    studentIds,
    createdAt: iso(-60 * DAY),
  }

  const p1 = {
    id: 1,
    name: "Application de gestion de bibliothèque",
    description:
      "Concevoir et développer une application web de gestion d’une bibliothèque : catalogue, emprunts, retours et statistiques.",
    status: "visible" as const,
    minGroupSize: 2,
    maxGroupSize: 3,
    groupFormationRule: "manual" as const,
    groupFormationDeadline: iso(-30 * DAY),
    promotionId: promotion.id,
    teacherId: teacher.id,
    createdAt: iso(-45 * DAY),
    updatedAt: iso(-3 * DAY),
  }
  const p2 = {
    id: 2,
    name: "Tableau de bord d’analytics",
    description:
      "Projet en préparation : visualiser les indicateurs d’utilisation d’un service (fréquentation, tendances, alertes).",
    status: "draft" as const,
    minGroupSize: 2,
    maxGroupSize: 4,
    groupFormationRule: "free" as const,
    groupFormationDeadline: iso(10 * DAY),
    promotionId: promotion.id,
    teacherId: teacher.id,
    createdAt: iso(-5 * DAY),
    updatedAt: iso(-1 * DAY),
  }

  // --- Groupes du projet 1 (Alex Moret = id 10 est dans le Groupe 1) ---
  const g1 = { id: 1, projectId: p1.id, name: "Groupe 1", memberIds: [10, 11, 12] }
  const g2 = { id: 2, projectId: p1.id, name: "Groupe 2", memberIds: [13, 14, 15] }
  const g3 = { id: 3, projectId: p1.id, name: "Groupe 3", memberIds: [16, 17] }

  const d1 = {
    id: 1,
    projectId: p1.id,
    name: "Cahier des charges et maquettes",
    description: "Document d’analyse des besoins, cas d’utilisation et maquettes de l’interface.",
    type: "archive" as const,
    deadline: iso(-7 * DAY),
    allowLateSubmission: true,
    penaltyPerHour: 0.5,
    createdAt: iso(-40 * DAY),
    updatedAt: iso(-40 * DAY),
  }
  const d2 = {
    id: 2,
    projectId: p1.id,
    name: "Code source de l’application",
    description: "Archive du dépôt Git contenant le code fonctionnel et les instructions d’installation.",
    type: "archive" as const,
    deadline: iso(10 * DAY),
    allowLateSubmission: true,
    penaltyPerHour: 0.5,
    createdAt: iso(-20 * DAY),
    updatedAt: iso(-20 * DAY),
  }
  const d3 = {
    id: 3,
    projectId: p1.id,
    name: "Lien du dépôt Git final",
    description: "URL du dépôt Git public avec README complet et tests.",
    type: "git_link" as const,
    deadline: iso(25 * DAY),
    allowLateSubmission: false,
    penaltyPerHour: 0,
    createdAt: iso(-20 * DAY),
    updatedAt: iso(-20 * DAY),
  }

  const rules = [
    { id: 1, deliverableId: d1.id, type: "file_presence" as const, configuration: JSON.stringify({ fileName: "README.md" }), errorMessage: "Le fichier README.md est requis." },
    { id: 2, deliverableId: d1.id, type: "max_size" as const, configuration: JSON.stringify({ maxSizeMB: 20 }), errorMessage: "Archive trop volumineuse." },
    { id: 3, deliverableId: d2.id, type: "file_presence" as const, configuration: JSON.stringify({ fileName: "README.md" }), errorMessage: "Le fichier README.md est requis." },
    { id: 4, deliverableId: d2.id, type: "max_size" as const, configuration: JSON.stringify({ maxSizeMB: 50 }), errorMessage: "Archive trop volumineuse (50 Mo maximum)." },
  ]

  const okResults = (configLabel: string) => [
    { type: "file_presence", configuration: "README.md", passed: true, message: "Fichier README.md présent." },
    { type: "max_size", configuration: "20 Mo", passed: true, message: configLabel },
  ]

  const submissions = [
    {
      id: 1,
      deliverableId: d1.id,
      groupId: g1.id,
      fileName: "cahier-des-charges-groupe-1.zip",
      fileSize: 4_718_592,
      submittedAt: iso(-8 * DAY),
      isLate: false,
      penalty: 0,
      similarityScore: 0.12,
      validationResults: okResults("Taille : 4,5 Mo (conforme)."),
    },
    {
      id: 2,
      deliverableId: d1.id,
      groupId: g2.id,
      fileName: "cahier-des-charges-groupe-2.zip",
      fileSize: 5_242_880,
      submittedAt: iso(-6 * DAY),
      isLate: true,
      penalty: 12,
      similarityScore: 0.31,
      validationResults: okResults("Taille : 5 Mo (conforme)."),
    },
    {
      // Groupe 3 : pas de rendu pour d1 (aucune soumission).
      // Groupe 2 a aussi rendu le livrable 2 en avance.
      id: 3,
      deliverableId: d2.id,
      groupId: g2.id,
      fileName: "code-source-groupe-2.zip",
      fileSize: 18_874_368,
      submittedAt: iso(-2 * DAY),
      isLate: false,
      penalty: 0,
      similarityScore: 0.08,
      validationResults: okResults("Taille : 18 Mo (conforme)."),
    },
  ]

  const reportConfig = {
    projectId: p1.id,
    isEnabled: true,
    format: "markdown" as const,
    deadline: iso(21 * DAY),
    instructions:
      "Rédigez un rapport structuré en Markdown. Chaque groupe rend une version unique, relisez-vous avant la soumission définitive.",
    sections: [
      {
        id: 101,
        title: "Introduction et contexte",
        description: "Présentez le besoin, les utilisateurs visés et le périmètre du projet.",
        required: true,
        wordLimit: 400,
        order: 1,
      },
      {
        id: 102,
        title: "Architecture technique",
        description: "Décrivez les choix techniques (stack, base de données, déploiement).",
        required: true,
        wordLimit: 600,
        order: 2,
      },
      {
        id: 103,
        title: "Bilan et perspectives",
        description: "Ce que vous avez appris, difficultés rencontrées, suites possibles.",
        required: false,
        wordLimit: 300,
        order: 3,
      },
    ],
  }

  const reports = [
    {
      id: 1,
      projectId: p1.id,
      groupId: g1.id,
      title: "Rapport — Groupe 1",
      status: "draft" as const,
      sections: [
        {
          sectionConfigId: 101,
          content:
            "## Introduction\n\nLe projet vise à digitaliser la gestion d’une bibliothèque municipale : catalogage des ouvrages, suivi des emprunts et relances automatiques des retards.",
          updatedAt: iso(-2 * DAY),
        },
        { sectionConfigId: 102, content: "", updatedAt: iso(-2 * DAY) },
        { sectionConfigId: 103, content: "", updatedAt: iso(-2 * DAY) },
      ],
    },
    {
      id: 2,
      projectId: p1.id,
      groupId: g2.id,
      title: "Rapport — Groupe 2",
      status: "draft" as const,
      sections: [
        {
          sectionConfigId: 101,
          content: "## Introduction\n\nApplication web de gestion de bibliothèque avec espace adhérent.",
          updatedAt: iso(-1 * DAY),
        },
        { sectionConfigId: 102, content: "", updatedAt: iso(-1 * DAY) },
        { sectionConfigId: 103, content: "", updatedAt: iso(-1 * DAY) },
      ],
    },
  ]

  const defenseStart = new Date(now + 14 * DAY)
  defenseStart.setHours(9, 0, 0, 0)
  const defenses = [g1, g2, g3].map((group, i) => {
    const start = new Date(defenseStart.getTime() + i * 35 * 60 * 1000)
    return {
      id: i + 1,
      projectId: p1.id,
      groupId: group.id,
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + 30 * 60 * 1000).toISOString(),
      orderIndex: i + 1,
      location: "Amphi B — Campus Nord",
    }
  })

  const gridLivrable = {
    id: 1,
    projectId: p1.id,
    name: "Évaluation des livrables",
    type: "deliverable" as const,
    weight: 0.4,
    description: "Qualité du contenu, conformité aux consignes et soin de la restitution.",
    criteria: [
      { id: 11, gridId: 1, name: "Complétude du livrable", description: "Tous les éléments demandés sont présents.", maxScore: 20, weight: 0.4, type: "group" as const, hasComments: true },
      { id: 12, gridId: 1, name: "Qualité rédactionnelle", description: "Clarté, orthographe, structure du document.", maxScore: 20, weight: 0.3, type: "group" as const, hasComments: true },
      { id: 13, gridId: 1, name: "Conformité technique", description: "Cohérence des choix avec le cahier des charges.", maxScore: 20, weight: 0.3, type: "group" as const, hasComments: true },
    ],
  }
  const gridRapport = {
    id: 2,
    projectId: p1.id,
    name: "Évaluation du rapport",
    type: "report" as const,
    weight: 0.25,
    description: "Structure, profondeur de l’analyse et restitution écrite.",
    criteria: [
      { id: 21, gridId: 2, name: "Structure du rapport", maxScore: 20, weight: 0.5, type: "group" as const, hasComments: true },
      { id: 22, gridId: 2, name: "Analyse et recul", maxScore: 20, weight: 0.5, type: "group" as const, hasComments: true },
    ],
  }
  const gridSoutenance = {
    id: 3,
    projectId: p1.id,
    name: "Évaluation de la soutenance",
    type: "defense" as const,
    weight: 0.35,
    description: "Clarté de la présentation, gestion des questions, répartition de la parole.",
    criteria: [
      { id: 31, gridId: 3, name: "Clarté de la présentation", maxScore: 20, weight: 0.4, type: "group" as const, hasComments: true },
      { id: 32, gridId: 3, name: "Réponses aux questions", maxScore: 20, weight: 0.4, type: "group" as const, hasComments: true },
      { id: 33, gridId: 3, name: "Répartition de la parole", maxScore: 20, weight: 0.2, type: "group" as const, hasComments: true },
    ],
  }

  // Livrable du Groupe 1 : noté et validé (visible côté étudiant).
  const sessionG1Livrable = {
    id: 1,
    gridId: gridLivrable.id,
    groupId: g1.id,
    entries: [
      { id: 101, criterionId: 11, score: 16, comment: "Analyse complète, cas d’utilisation bien identifiés." },
      { id: 102, criterionId: 12, score: 14, comment: "Quelques coquilles, structure claire." },
      { id: 103, criterionId: 13, score: 15, comment: "Choix techniques cohérents." },
    ],
    globalComment: "Bon travail d’ensemble. Soignez la relecture orthographique.",
    totalScore: 15.1,
    status: "validated" as const,
    gradedBy: teacher.id,
    gradedAt: iso(-5 * DAY),
    submittedAt: iso(-5 * DAY),
    validatedAt: iso(-5 * DAY),
  }
  // Soutenance du Groupe 2 : brouillon commencé.
  const sessionG2Soutenance = {
    id: 2,
    gridId: gridSoutenance.id,
    groupId: g2.id,
    entries: [
      { id: 201, criterionId: 31, score: 12, comment: "" },
      { id: 202, criterionId: 32, score: 10, comment: "" },
      { id: 203, criterionId: 33, score: 0, comment: "" },
    ],
    globalComment: "",
    totalScore: 10.8,
    status: "draft" as const,
    gradedBy: teacher.id,
    gradedAt: iso(-1 * DAY),
  }

  return {
    users,
    promotions: [promotion],
    projects: [p1, p2],
    groups: [g1, g2, g3],
    deliverables: [d1, d2, d3],
    rules,
    submissions,
    reportConfigs: [reportConfig],
    reports,
    defenses,
    grids: [gridLivrable, gridRapport, gridSoutenance],
    sessions: [sessionG1Livrable, sessionG2Soutenance],
    seq: 1000,
  }
}
