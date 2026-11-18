// services/group.service.ts
import { Repository } from 'typeorm';
import { AppDataSource } from '../database/data-source';
import { Group,User,Project } from '../entities/Entities';


export class GroupService {
  private groupRepository: Repository<Group>;
  private userRepository: Repository<User>;
  private projectRepository: Repository<Project>;

  constructor() {
    this.groupRepository = AppDataSource.getRepository(Group);
    this.userRepository = AppDataSource.getRepository(User);
    this.projectRepository = AppDataSource.getRepository(Project);
  }

  async createGroup(projectId: number, name: string, memberIds: number[]): Promise<Group> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) throw new Error('Project not found');

    const members = await this.userRepository.findByIds(memberIds);
    
    // Vérifications
    if (project.minGroupSize && members.length < project.minGroupSize) {
      throw new Error(`Group must have at least ${project.minGroupSize} members`);
    }
    
    if (project.maxGroupSize && members.length > project.maxGroupSize) {
      throw new Error(`Group cannot have more than ${project.maxGroupSize} members`);
    }

    const group = this.groupRepository.create({
      name,
      project,
      members
    });

    return await this.groupRepository.save(group);
  }

  async joinGroup(groupId: number, studentId: number): Promise<Group> {
    const group = await this.groupRepository.findOne({
      where: { id: groupId },
      relations: ['project', 'members']
    });

    if (!group) throw new Error('Group not found');

    const project = group.project;
    if (project.groupFormationRule !== 'free') {
      throw new Error('Students cannot join groups for this project');
    }

    if (project.groupFormationDeadline && new Date() > project.groupFormationDeadline) {
      throw new Error('Group formation deadline has passed');
    }

    const student = await this.userRepository.findOne({ where: { id: studentId } });
    if (!student) throw new Error('Student not found');

    if (project.maxGroupSize && group.members.length >= project.maxGroupSize) {
      throw new Error('Group is full');
    }

    if (group.members.some(m => m.id === studentId)) {
      throw new Error('Student is already in this group');
    }

    group.members.push(student);
    return await this.groupRepository.save(group);
  }

  async getGroupsByProject(projectId: number): Promise<Group[]> {
    return await this.groupRepository.find({
      where: { project: { id: projectId } },
      relations: ['members']
    });
  }

  /**
   * Sauvegarde complète de la répartition des groupes d'un projet.
   * Chaque groupe du payload voit sa liste de membres remplacée ; les groupes
   * absents du payload sont vidés (leurs lignes restent : soumissions/rapports liés).
   */
  async saveProjectGrouping(
    projectId: number,
    groups: { id: number; memberIds: number[] }[],
    _unassignedIds: number[]
  ): Promise<{ message: string; updatedGroups: number; affectedLinks: number }> {
    const project = await this.projectRepository.findOne({
      where: { id: projectId },
      relations: ['groups', 'groups.members']
    });
    if (!project) throw new Error('Project not found');

    const allMemberIds = groups.flatMap(g => g.memberIds);
    const members = allMemberIds.length > 0
      ? await this.userRepository.findByIds(allMemberIds)
      : [];
    const memberById = new Map(members.map(m => [m.id, m]));

    let updatedGroups = 0;
    let affectedLinks = 0;

    for (const groupData of groups) {
      const groupMembers = groupData.memberIds
        .map(id => memberById.get(id))
        .filter((m): m is User => Boolean(m));

      const existing = project.groups.find(g => g.id === groupData.id);
      if (existing) {
        existing.members = groupMembers;
      } else {
        project.groups.push(this.groupRepository.create({
          name: `Groupe ${project.groups.length + 1}`,
          project,
          members: groupMembers
        }));
      }
      updatedGroups++;
      affectedLinks += groupMembers.length;
    }

    // Groupes retirés du board : on détache leurs membres sans supprimer la ligne
    // (les soumissions et rapports y restent rattachés).
    for (const group of project.groups) {
      const inPayload = groups.some(g => g.id === group.id);
      if (!inPayload && group.members && group.members.length > 0) {
        group.members = [];
      }
    }

    await this.groupRepository.save(project.groups);

    return {
      message: 'Répartition des groupes enregistrée',
      updatedGroups,
      affectedLinks
    };
  }
}