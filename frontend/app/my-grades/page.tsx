"use client"

import { BACKEND_URL, assertOk } from "@/lib/api"
import { formatDate, formatNumber, formatPercent, formatDecimal } from "@/lib/format"
import { useEffect, useState } from "react"
import { MainLayout } from "@/components/layout/main-layout"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  BarChart3,
  FileText,
  BookOpen,
  Users,
  TrendingUp,
  Search,
  SlidersHorizontal,
  Bell,
  LayoutGrid,
  List
} from "lucide-react"
import { motion } from "framer-motion"
import { ProtectedRoute } from "@/components/auth/protected-route"
import { ErrorState } from "@/components/shared/ErrorState"

interface StudentGrade {
  id: number
  projectName: string
  projectId: number
  groupName: string
  type: "deliverable" | "report" | "defense"
  title: string
  grade: number
  maxGrade: number
  feedback: string | null
  gradedAt: Date
  criteria: Array<{
    name: string
    score: number
    maxScore: number
    comments: string | null
    weight: number
  }>
}

export default function MyGradesPage() {
  return (
    <ProtectedRoute roles={["student"]}>
      <MyGradesPageContent />
    </ProtectedRoute>
  )
}

function MyGradesPageContent() {
  const [grades, setGrades] = useState<StudentGrade[]>([])
  const [filteredGrades, setFilteredGrades] = useState<StudentGrade[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  
  const [filterType, setFilterType] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("date")
  const [searchQuery, setSearchQuery] = useState("")
  
  const [viewMode, setViewMode] = useState<'detailed' | 'compact'>('detailed')
  
  const [newGradesCount, setNewGradesCount] = useState(0)

  useEffect(() => {
    fetchGrades()
  }, [])

  const fetchGrades = async () => {
    try {
      setLoadError(null)
      const response = await fetch(`${BACKEND_URL}/api/grading/students/my-grades`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      await assertOk(response)

      const data = await response.json()
      const gradesData = data.map((g: any) => ({
        ...g,
        gradedAt: new Date(g.gradedAt)
      }))

      setGrades(gradesData)

      checkNewGrades(gradesData)
    } catch {
      setLoadError("Impossible de charger vos notes. Vérifiez que le service est accessible puis réessayez.")
    } finally {
      setLoading(false)
    }
  }

  const checkNewGrades = (gradesData: StudentGrade[]) => {
    const lastViewedDate = localStorage.getItem('lastGradesView')
    if (lastViewedDate) {
      const newGrades = gradesData.filter(
        g => g.gradedAt.getTime() > new Date(lastViewedDate).getTime()
      )
      setNewGradesCount(newGrades.length)
    }
    localStorage.setItem('lastGradesView', new Date().toISOString())
  }

  useEffect(() => {
    let result = [...grades]

    if (filterType !== "all") {
      result = result.filter(g => g.type === filterType)
    }

    if (searchQuery) {
      result = result.filter(g =>
        g.projectName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.groupName.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    switch (sortBy) {
      case "date":
        result.sort((a, b) => b.gradedAt.getTime() - a.gradedAt.getTime())
        break
      case "grade-desc":
        result.sort((a, b) => (b.grade / b.maxGrade) - (a.grade / a.maxGrade))
        break
      case "grade-asc":
        result.sort((a, b) => (a.grade / a.maxGrade) - (b.grade / b.maxGrade))
        break
      case "project":
        result.sort((a, b) => a.projectName.localeCompare(b.projectName))
        break
    }

    setFilteredGrades(result)
  }, [grades, filterType, sortBy, searchQuery])

  const gradesByProject = filteredGrades.reduce((acc, grade) => {
    if (!acc[grade.projectId]) {
      acc[grade.projectId] = {
        projectName: grade.projectName,
        projectId: grade.projectId,
        grades: []
      }
    }
    acc[grade.projectId].grades.push(grade)
    return acc
  }, {} as Record<number, { projectName: string; projectId: number; grades: StudentGrade[] }>)


  const getTypeIcon = (type: StudentGrade["type"]) => {
    switch (type) {
      case "deliverable":
        return <FileText className="h-4 w-4" />
      case "report":
        return <BookOpen className="h-4 w-4" />
      case "defense":
        return <Users className="h-4 w-4" />
    }
  }

  const getTypeLabel = (type: StudentGrade["type"]) => {
    switch (type) {
      case "deliverable":
        return "Livrable"
      case "report":
        return "Rapport"
      case "defense":
        return "Soutenance"
    }
  }

  const getGradeColor = (grade: number, maxGrade: number) => {
    const percentage = (grade / maxGrade) * 100
    if (percentage >= 80) return "text-green-600"
    if (percentage >= 60) return "text-yellow-600"
    return "text-red-600"
  }

  const getGradeBgColor = (grade: number, maxGrade: number) => {
    const percentage = (grade / maxGrade) * 100
    if (percentage >= 80) return "border-green-500"
    if (percentage >= 60) return "border-yellow-500"
    return "border-red-500"
  }

 
  const averageGrade = grades.length > 0
    ? grades.reduce((sum, grade) => sum + (grade.grade / grade.maxGrade) * 20, 0) / grades.length
    : 0

  const totalGrades = grades.length
  const excellentGrades = grades.filter((g) => (g.grade / g.maxGrade) * 20 >= 16).length
  const passedGrades = grades.filter((g) => (g.grade / g.maxGrade) * 20 >= 10).length

  if (loading) {
    return (
      <MainLayout>
        <div className="p-6">
          <div className="flex items-center justify-center h-64">
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground">Chargement de vos notes...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    )
  }

  if (loadError) {
    return (
      <MainLayout>
        <div className="p-6">
          <ErrorState message={loadError} onRetry={fetchGrades} />
        </div>
      </MainLayout>
    )
  }

  const renderGradeCard = (grade: StudentGrade, index: number) => (
    <motion.div
      key={grade.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <Card className={`border-l-4 ${getGradeBgColor(grade.grade, grade.maxGrade)}`}>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="text-lg flex items-center space-x-2">
                {getTypeIcon(grade.type)}
                <span>{grade.title}</span>
              </CardTitle>
              <CardDescription className="flex items-center space-x-2 flex-wrap">
                <Badge variant="outline">{getTypeLabel(grade.type)}</Badge>
                <span>•</span>
                <span>{grade.projectName}</span>
                <span>•</span>
                <span>{grade.groupName}</span>
              </CardDescription>
            </div>
            <div className="text-right">
              <div className={`text-2xl font-bold ${getGradeColor(grade.grade, grade.maxGrade)}`}>
                {formatNumber(grade.grade, 1)}/{grade.maxGrade}
              </div>
              {grade.maxGrade !== 20 && (
                <div className="text-sm text-muted-foreground mt-1">
                  {formatNumber((grade.grade / grade.maxGrade) * 20, 1)}/20
                </div>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {formatDate(grade.gradedAt)}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
            {grade.feedback && (
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="text-sm font-medium mb-1 flex flex-wrap items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Commentaires de l’enseignant
                </h4>
                <p className="text-sm text-muted-foreground">{grade.feedback}</p>
              </div>
            )}

            {grade.criteria && grade.criteria.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium flex flex-wrap items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  Détail par critère
                </h4>
                <div className="space-y-2">
                  {grade.criteria.map((criterion, idx) => (
                    <div key={idx} className="flex flex-wrap items-center justify-between text-sm border-l-2 pl-3 py-1">
                      <div className="flex-1">
                        <span className="text-muted-foreground">{criterion.name}</span>
                        {criterion.comments && (
                          <p className="text-xs text-muted-foreground italic mt-1">{criterion.comments}</p>
                        )}
                      </div>
                      <div className="text-right ml-4">
                        <span className="font-medium">
                          {formatNumber(criterion.score, 1)}/{criterion.maxScore}
                        </span>
                        <span className="text-xs text-muted-foreground ml-2">
                          (×{formatDecimal(criterion.weight)})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

     
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  return (
    <MainLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex flex-wrap items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex flex-wrap items-center gap-3">
                Mes notes
                {newGradesCount > 0 && (
                  <Badge variant="destructive" className="animate-pulse">
                    <Bell className="h-3 w-3 mr-1" />
                    {newGradesCount} nouvelle{newGradesCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </h1>
              <p className="text-muted-foreground">Notes publiées par vos enseignants.</p>
            </div>
       
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-wrap flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Moyenne</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(averageGrade, 2)}/20</div>
              <p className="text-xs text-muted-foreground">Sur tous les projets</p>
              <Progress value={(averageGrade / 20) * 100} className="h-1 mt-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-wrap flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Notes reçues</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalGrades}</div>
              <p className="text-xs text-muted-foreground">Évaluations notées</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-wrap flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Excellentes notes</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{excellentGrades}</div>
              <p className="text-xs text-muted-foreground">Notes ≥ 16/20</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-wrap flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Taux de réussite</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatPercent(totalGrades > 0 ? passedGrades / totalGrades : 0)}
              </div>
              <p className="text-xs text-muted-foreground">Notes ≥ 10/20</p>
            </CardContent>
          </Card>
        </div>

      

        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un projet, évaluation ou groupe..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les types</SelectItem>
                    <SelectItem value="deliverable">Livrables</SelectItem>
                    <SelectItem value="report">Rapports</SelectItem>
                    <SelectItem value="defense">Soutenances</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Trier par" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date"> Plus récent</SelectItem>
                    <SelectItem value="grade-desc">Note décroissante</SelectItem>
                    <SelectItem value="grade-asc"> Note croissante</SelectItem>
                    <SelectItem value="project"> Projet (A-Z)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  {filteredGrades.length} résultat{filteredGrades.length > 1 ? 's' : ''} trouvé{filteredGrades.length > 1 ? 's' : ''}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={viewMode === 'detailed' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('detailed')}
                  >
                    <LayoutGrid className="h-4 w-4 mr-1" />
                    Détaillée
                  </Button>
                  <Button
                    variant={viewMode === 'compact' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('compact')}
                  >
                    <List className="h-4 w-4 mr-1" />
                    Compacte
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {grades.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Aucune note disponible</p>
                <p className="text-sm mt-2">Vos notes apparaîtront ici une fois validées par l’enseignant</p>
              </div>
            </CardContent>
          </Card>
        ) : filteredGrades.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-muted-foreground">
                <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">Aucun résultat</p>
                <p className="text-sm mt-2">Essayez de modifier vos critères de recherche</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all" className="space-y-4">
            <TabsList>
              <TabsTrigger value="all">Toutes les notes</TabsTrigger>
              <TabsTrigger value="by-project">Par projet</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="space-y-4">
              {viewMode === 'detailed' ? (
                <div className="grid gap-6">
                  {filteredGrades.map((grade, index) => renderGradeCard(grade, index))}
                </div>
              ) : (
                <Card>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Projet</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Titre</TableHead>
                        <TableHead>Groupe</TableHead>
                        <TableHead className="text-right">Note</TableHead>
                        <TableHead className="text-right">/20</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredGrades.map((grade) => (
                        <TableRow key={grade.id}>
                          <TableCell className="font-medium">{grade.projectName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="flex items-center gap-1 w-fit">
                              {getTypeIcon(grade.type)}
                              {getTypeLabel(grade.type)}
                            </Badge>
                          </TableCell>
                          <TableCell>{grade.title}</TableCell>
                          <TableCell>{grade.groupName}</TableCell>
                          <TableCell className={`text-right font-bold ${getGradeColor(grade.grade, grade.maxGrade)}`}>
                            {formatNumber(grade.grade, 1)}/{grade.maxGrade}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatNumber((grade.grade / grade.maxGrade) * 20, 1)}/20
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDate(grade.gradedAt)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="by-project">
              <Accordion type="multiple" className="space-y-4">
                {Object.values(gradesByProject).map((project) => {
                  const projectAverage = project.grades.reduce(
                    (sum, g) => sum + (g.grade / g.maxGrade) * 20,
                    0
                  ) / project.grades.length

                  return (
                    <AccordionItem key={project.projectId} value={`project-${project.projectId}`}>
                      <Card>
                        <AccordionTrigger className="px-6 py-4 hover:no-underline">
                          <div className="flex flex-wrap items-center justify-between w-full pr-4">
                            <div className="flex flex-wrap items-center gap-3">
                              <BookOpen className="h-5 w-5 text-muted-foreground" />
                              <div className="text-left">
                                <h3 className="font-semibold text-lg">{project.projectName}</h3>
                                <p className="text-sm text-muted-foreground">
                                  {project.grades.length} évaluation{project.grades.length > 1 ? 's' : ''}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">Moyenne</div>
                                <Badge variant="outline" className="text-base font-bold">
                                  {formatNumber(projectAverage, 2)}/20
                                </Badge>
                              </div>
                            </div>
                          </div>
                        </AccordionTrigger>

                        <AccordionContent>
                          <div className="px-6 pb-4 space-y-4">
                            {project.grades.map((grade, index) => (
                              <div key={grade.id}>
                                {renderGradeCard(grade, index)}
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                          </Card>
                    </AccordionItem>
                  )
                })}
              </Accordion>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </MainLayout>
  )
}
