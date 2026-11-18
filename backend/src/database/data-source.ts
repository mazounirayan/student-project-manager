import "reflect-metadata";
import { DataSource } from "typeorm";
import * as dotenv from "dotenv";
import { CriterionGrade, Defense, Deliverable, DeliverableRule, DeliverableSubmission, Grade, GradingCriterion, GradingGrid, Group, Project,Report, Promotion, ReportSection, User } from "../entities/Entities";
dotenv.config();

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    username: process.env.DB_USER ,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'projectacademy',
    synchronize: process.env.DB_SYNCHRONIZE === 'true' && process.env.NODE_ENV !== 'production',
    logging: process.env.DB_LOGGING === 'true',
    entities: [User, Project, Promotion,Group,Deliverable,DeliverableRule,DeliverableSubmission,Report,
      ReportSection, Defense,GradingGrid,GradingCriterion,Grade,CriterionGrade
    ],
    migrations: ["src/migrations/*.ts"],
    subscribers: ["src/subscribers/*.ts"],
});
