"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Users, Search, Mail, Calendar, UserCheck } from "lucide-react"
import type { Student } from "@/types/project"

interface StudentsListDialogProps {
  promotionName: string
  students: Student[]
  trigger?: React.ReactNode
}

import { formatDate } from "@/lib/date"

export function StudentsListDialog({ promotionName, students, trigger }: StudentsListDialogProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  const filteredStudents = students.filter(
    (student) =>
      student?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student?.email?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const studentsWithGroups = filteredStudents.filter((student) => student.groupId)
  const studentsWithoutGroups = filteredStudents.filter((student) => !student.groupId)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <Users className="mr-2 h-4 w-4" />
            Voir les étudiants
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Étudiants de la promotion {promotionName}
          </DialogTitle>
          <DialogDescription>
            {students.length} étudiant{students.length > 1 ? "s" : ""} inscrit{students.length > 1 ? "s" : ""} dans
            cette promotion
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher un étudiant par nom ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Statistics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-primary">{students.length}</div>
              <div className="text-sm text-muted-foreground">Total</div>
            </div>
            {/* <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">{studentsWithGroups.length}</div>
              <div className="text-sm text-muted-foreground">En groupe</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-orange-600">{studentsWithoutGroups.length}</div>
              <div className="text-sm text-muted-foreground">Sans groupe</div>
            </div> */}
          </div>

          {/* Students list */}
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Aucun étudiant trouvé</p>
              </div>
            ) : (
              filteredStudents?.map((student) => (
                <div
                  key={student.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>
                        {student.name?.split(" ")
                          ?.map((n) => n[0])
                          .join("")
                          .toUpperCase()
                          .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium">{student.name}</div>
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Mail className="h-3 w-3 mr-1" />
                        {student.email}
                      </div>
                    </div>
                  </div>

                  {/* <div className="flex items-center space-x-2">
                    {student.groupId ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-800">
                        <UserCheck className="h-3 w-3 mr-1" />
                        En groupe
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-orange-600 border-orange-200">
                        Sans groupe
                      </Badge>
                    )}
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 mr-1" />
                      {formatDate(student?.createdAt)}
                    </div>
                  </div> */}
                </div>
              ))
            )}
          </div>

          {/* Footer with actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              {filteredStudents.length} étudiant{filteredStudents.length > 1 ? "s" : ""} affiché
              {filteredStudents.length > 1 ? "s" : ""}
            </div>
            <Button onClick={() => setOpen(false)}>Fermer</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
