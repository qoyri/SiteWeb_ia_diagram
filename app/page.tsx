"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import DiagramVisualizer from "../diagram-visualizer"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Copy, FileJson, Loader2, Sparkles, Settings, BookOpen, Upload, X } from "lucide-react"
import { samplePrompts } from "./sample-prompts"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { motion } from "framer-motion"

export default function Home() {
  const [textInput, setTextInput] = useState("")
  const [apiType, setApiType] = useState("ollama")
  const [ollamaEndpoint, setOllamaEndpoint] = useState("http://localhost:11434/api/generate")
  const [ollamaModel, setOllamaModel] = useState("llama3")
  const [openaiApiKey, setOpenaiApiKey] = useState("")
  const [openaiModel, setOpenaiModel] = useState("gpt-3.5-turbo")
  const [parsedData, setParsedData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [rawResponse, setRawResponse] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("editor")
  const [uploadedImage, setUploadedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Effet pour charger la clé API OpenAI depuis le localStorage
  useEffect(() => {
    const savedApiKey = localStorage.getItem("openai-api-key")
    if (savedApiKey) {
      setOpenaiApiKey(savedApiKey)
    }
  }, [])

  // Sauvegarder la clé API OpenAI dans le localStorage
  const saveApiKey = (key: string) => {
    setOpenaiApiKey(key)
    localStorage.setItem("openai-api-key", key)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setUploadedImage(file)
      const reader = new FileReader()
      reader.onload = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const removeUploadedImage = () => {
    setUploadedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const generateDiagram = async () => {
    if (!textInput.trim()) {
      setError("Veuillez entrer une description de votre diagramme.")
      return
    }

    if (apiType === "openai" && !openaiApiKey) {
      setError("Veuillez entrer votre clé API OpenAI.")
      return
    }

    setIsLoading(true)
    setError(null)
    setParsedData(null)
    setRawResponse(null)

    const prompt = `
  Génère un diagramme basé sur cette description: "${textInput}".
  
  Réponds UNIQUEMENT avec un objet JSON valide qui contient deux tableaux: "nodes" et "edges".
  
  IMPORTANT: Ne mets PAS de backticks (\`\`\`) au début ou à la fin de ta réponse. Ne formate pas ta réponse comme un bloc de code. Renvoie uniquement l'objet JSON brut.
  
  Format attendu:
  {
    "nodes": [
      {
        "id": "1",
        "label": "Nom du nœud",
        "position": { "x": 100, "y": 100 },
        "style": { "backgroundColor": "#couleur", "borderRadius": "8px", "padding": "10px", "border": "1px solid #couleur" }
      },
      ...
    ],
    "edges": [
      { "id": "e1-2", "source": "1", "target": "2", "label": "Description de la connexion" },
      ...
    ]
  }
  
  IMPORTANT pour le positionnement:
  - Organise les nœuds de manière hiérarchique et logique
  - Pour les organigrammes: place les éléments de niveau supérieur en haut
  - Pour les flux de processus: organise les étapes de gauche à droite ou de haut en bas
  - Pour les cartes mentales: place le concept principal au centre
  - Évite les chevauchements entre les nœuds
  - Utilise des coordonnées x,y cohérentes (ex: nœuds parents au-dessus des enfants)
  - Espace les nœuds d'au moins 150 pixels sur l'axe x et 100 pixels sur l'axe y
  
  Utilise des couleurs appropriées et cohérentes pour représenter différents types d'éléments.
  N'inclus AUCUN texte explicatif, seulement l'objet JSON.
  
  RAPPEL: Ne mets PAS de backticks (\`\`\`) ou de mot-clé "json" dans ta réponse. Renvoie uniquement l'objet JSON brut.
`

    try {
      let responseContent = ""

      if (apiType === "ollama") {
        // Utiliser l'API Ollama
        const isUsingChatAPI = ollamaEndpoint.includes("/api/chat")
        let requestBody = {}

        if (isUsingChatAPI) {
          requestBody = {
            model: ollamaModel,
            messages: [{ role: "user", content: prompt }],
            stream: false,
          }
        } else {
          requestBody = {
            model: ollamaModel,
            prompt: prompt,
            stream: false,
          }
        }

        const response = await fetch(ollamaEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })

        if (!response.ok) {
          throw new Error(`Erreur API Ollama: ${response.status} ${response.statusText}`)
        }

        const data = await response.json()

        // Extraire le contenu selon le type d'API
        if (isUsingChatAPI) {
          responseContent = data.message?.content || ""
        } else {
          responseContent = data.response || ""
        }
      } else {
        // Utiliser l'API OpenAI
        const messages = [
          {
            role: "system",
            content:
              "Tu es un assistant spécialisé dans la création de diagrammes. Tu réponds uniquement avec du JSON valide selon le format demandé.",
          },
        ]

        // Si une image est uploadée, l'ajouter au message
        if (uploadedImage && imagePreview) {
          // Vérifier si le modèle supporte les images
          const supportsImages = ["gpt-4-vision", "gpt-4o"].includes(openaiModel)

          if (supportsImages) {
            messages.push({
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "image_url",
                  image_url: {
                    url: imagePreview,
                  },
                },
              ],
            })
          } else {
            // Fallback pour les modèles qui ne supportent pas les images
            messages.push({
              role: "user",
              content: `${prompt} (Note: une image a été fournie mais le modèle sélectionné ne supporte pas l'analyse d'images)`,
            })
          }
        } else {
          messages.push({
            role: "user",
            content: prompt,
          })
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiApiKey}`,
          },
          body: JSON.stringify({
            model: openaiModel,
            messages,
            temperature: 0.7,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(`Erreur API OpenAI: ${response.status} ${response.statusText} - ${JSON.stringify(errorData)}`)
        }

        const data = await response.json()
        responseContent = data.choices?.[0]?.message?.content || ""
      }

      setRawResponse(responseContent)
      console.log("Réponse brute:", responseContent)

      try {
        // Nettoyer la chaîne JSON avant de la parser
        // Supprimer les espaces au début et à la fin
        let cleanedContent = responseContent.trim()

        // Si le contenu commence par un backtick (code block), le supprimer
        if (cleanedContent.startsWith("```")) {
          const endCodeBlock = cleanedContent.indexOf("```", 3)
          if (endCodeBlock !== -1) {
            cleanedContent = cleanedContent.substring(endCodeBlock + 3).trim()
          } else {
            cleanedContent = cleanedContent.substring(3).trim()
          }
        }

        // Si le contenu commence par "json", le supprimer
        if (cleanedContent.startsWith("json")) {
          cleanedContent = cleanedContent.substring(4).trim()
        }

        // Extraire le JSON si entouré d'accolades
        const jsonMatch = cleanedContent.match(/(\{[\s\S]*\})/)
        if (jsonMatch) {
          cleanedContent = jsonMatch[1]
        }

        console.log("Contenu nettoyé:", cleanedContent)

        const parsedJson = JSON.parse(cleanedContent)
        if (!parsedJson.nodes || !parsedJson.edges) {
          throw new Error("Le JSON ne contient pas les propriétés 'nodes' et 'edges' requises")
        }

        // Ajouter des positions par défaut si elles sont manquantes
        parsedJson.nodes = parsedJson.nodes.map((node: any, index: number) => ({
          ...node,
          position: node.position || { x: 100 + (index % 3) * 200, y: 100 + Math.floor(index / 3) * 150 },
        }))

        setParsedData(parsedJson)
      } catch (jsonError) {
        console.error("Erreur de parsing JSON:", jsonError)
        setError("Impossible de parser la réponse JSON. Vérifiez la console pour plus de détails.")
      }
    } catch (err: any) {
      console.error("Erreur lors de l'appel API:", err)
      setError(`Erreur: ${err.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const loadSample = (sample: string) => {
    setTextInput(sample)
    setActiveTab("editor")
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/80 pb-10">
      <header className="py-6 px-4 border-b border-border/40 bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <span>Générateur de Diagrammes par IA</span>
          </h1>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:inline-block">
              Transformez vos idées en diagrammes visuels
            </span>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 mt-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-8"
        >
          <Card className="col-span-1 overflow-hidden border-border/50 shadow-lg">
            <CardHeader className="bg-muted/30 border-b border-border/30">
              <CardTitle className="flex items-center gap-2">
                <span>Description du Diagramme</span>
              </CardTitle>
              <CardDescription>
                Décrivez le diagramme que vous souhaitez générer ou choisissez un exemple
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start rounded-none border-b border-border/30 bg-muted/30 p-0">
                  <TabsTrigger
                    value="editor"
                    className="flex items-center gap-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
                  >
                    <FileJson className="h-4 w-4" />
                    <span>Éditeur</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="examples"
                    className="flex items-center gap-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Exemples</span>
                  </TabsTrigger>
                  <TabsTrigger
                    value="settings"
                    className="flex items-center gap-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Paramètres</span>
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="editor" className="p-6 mt-0">
                  <Textarea
                    placeholder="Décrivez votre diagramme ici. Par exemple: Un organigramme d'entreprise avec un PDG, deux directeurs et cinq employés..."
                    className="min-h-[200px] resize-none border-border/50 bg-background"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                  />
                  {apiType === "openai" && (
                    <div className="mt-4 border border-border/50 rounded-md p-4 bg-muted/20">
                      <div className="flex items-center justify-between mb-2">
                        <Label htmlFor="image-upload" className="text-sm font-medium">
                          Ajouter une image (uniquement avec GPT-4o)
                        </Label>
                        {imagePreview && (
                          <Button variant="ghost" size="sm" onClick={removeUploadedImage} className="h-8 px-2">
                            <X className="h-4 w-4 mr-1" />
                            Supprimer
                          </Button>
                        )}
                      </div>

                      {imagePreview ? (
                        <div className="relative mt-2 rounded-md overflow-hidden border border-border">
                          <img
                            src={imagePreview || "/placeholder.svg"}
                            alt="Preview"
                            className="max-h-[200px] w-auto mx-auto"
                          />
                        </div>
                      ) : (
                        <div
                          className="border-2 border-dashed border-border/50 rounded-md p-8 text-center cursor-pointer hover:bg-muted/20 transition-colors"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Cliquez pour uploader une image</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            L'image sera analysée par l'IA pour générer un diagramme
                          </p>
                        </div>
                      )}
                      <input
                        ref={fileInputRef}
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </div>
                  )}
                  {error && (
                    <Alert variant="destructive" className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Erreur</AlertTitle>
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}
                </TabsContent>
                <TabsContent value="examples" className="p-6 mt-0">
                  <div className="grid gap-4">
                    {samplePrompts.map((sample, index) => (
                      <Card
                        key={index}
                        className="cursor-pointer hover:bg-accent/50 transition-colors border-border/50"
                        onClick={() => loadSample(sample.text)}
                      >
                        <CardHeader className="p-4">
                          <CardTitle className="text-base flex items-center">
                            <FileJson className="mr-2 h-4 w-4 text-primary" />
                            {sample.title}
                          </CardTitle>
                        </CardHeader>
                      </Card>
                    ))}
                  </div>
                </TabsContent>
                <TabsContent value="settings" className="p-6 mt-0">
                  <div className="space-y-6">
                    <div>
                      <Label className="text-base font-medium mb-4 block">Type d'API</Label>
                      <RadioGroup value={apiType} onValueChange={setApiType} className="flex flex-col space-y-3">
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="ollama" id="ollama" />
                          <Label htmlFor="ollama">Ollama (local)</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="openai" id="openai" />
                          <Label htmlFor="openai">OpenAI (API)</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {apiType === "ollama" ? (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="ollama-endpoint">URL de l'API Ollama</Label>
                          <Input
                            id="ollama-endpoint"
                            value={ollamaEndpoint}
                            onChange={(e) => setOllamaEndpoint(e.target.value)}
                            placeholder="http://localhost:11434/api/generate"
                            className="border-border/50 bg-background"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Utilisez /api/generate pour la génération de texte ou /api/chat pour le chat
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="ollama-model">Modèle Ollama</Label>
                          <Input
                            id="ollama-model"
                            value={ollamaModel}
                            onChange={(e) => setOllamaModel(e.target.value)}
                            placeholder="llama3"
                            className="border-border/50 bg-background"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Exemple: llama3, mistral, codellama, etc.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="openai-api-key">Clé API OpenAI</Label>
                          <Input
                            id="openai-api-key"
                            type="password"
                            value={openaiApiKey}
                            onChange={(e) => saveApiKey(e.target.value)}
                            placeholder="sk-..."
                            className="border-border/50 bg-background"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Votre clé API OpenAI commençant par sk-...
                          </p>
                        </div>
                        <div>
                          <Label htmlFor="openai-model">Modèle OpenAI</Label>
                          <Select value={openaiModel} onValueChange={setOpenaiModel}>
                            <SelectTrigger id="openai-model" className="border-border/50 bg-background">
                              <SelectValue placeholder="Sélectionnez un modèle" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                              <SelectItem value="gpt-3.5-turbo-16k">GPT-3.5 Turbo 16K</SelectItem>
                              <SelectItem value="gpt-4">GPT-4</SelectItem>
                              <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                              <SelectItem value="gpt-4o">GPT-4o (Recommandé pour les images)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
            <CardFooter className="flex justify-between p-4 border-t border-border/30 bg-muted/30">
              <Button variant="outline" onClick={() => navigator.clipboard.writeText(textInput)}>
                <Copy className="mr-2 h-4 w-4" />
                Copier
              </Button>
              <Button onClick={generateDiagram} disabled={isLoading} className="bg-primary hover:bg-primary/90">
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Génération...
                  </>
                ) : (
                  "Générer le Diagramme"
                )}
              </Button>
            </CardFooter>
          </Card>

          <Card className="col-span-1 overflow-hidden border-border/50 shadow-lg">
            <CardHeader className="bg-muted/30 border-b border-border/30">
              <CardTitle>Diagramme Généré</CardTitle>
              <CardDescription>Visualisation animée de votre diagramme</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="min-h-[400px] flex items-center justify-center">
                {isLoading ? (
                  <motion.div
                    className="flex flex-col items-center justify-center"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <Loader2 className="h-10 w-10 animate-spin mb-4 text-primary" />
                    <p className="text-muted-foreground">Génération du diagramme en cours...</p>
                  </motion.div>
                ) : parsedData ? (
                  <DiagramVisualizer data={parsedData} />
                ) : (
                  <div className="text-center text-muted-foreground p-8 border border-dashed border-border/50 rounded-lg w-full h-full flex items-center justify-center">
                    {error ? (
                      <p>Veuillez corriger les erreurs pour générer le diagramme</p>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <FileJson className="h-16 w-16 text-muted-foreground/50" />
                        <p>Décrivez votre diagramme et cliquez sur "Générer le Diagramme"</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
            {rawResponse && (
              <CardFooter className="p-0 border-t border-border/30">
                <Tabs defaultValue="diagram" className="w-full">
                  <TabsList className="w-full justify-start rounded-none border-b border-border/30 bg-muted/30 p-0">
                    <TabsTrigger
                      value="diagram"
                      className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
                    >
                      Diagramme
                    </TabsTrigger>
                    <TabsTrigger
                      value="json"
                      className="rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary"
                    >
                      Réponse JSON
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="diagram" className="p-0 mt-0">
                    {/* Le diagramme est déjà affiché dans le CardContent */}
                  </TabsContent>
                  <TabsContent value="json" className="p-4 mt-0">
                    <div className="w-full max-h-[200px] overflow-auto bg-muted/50 p-4 rounded-md border border-border/50">
                      <pre className="text-xs">{rawResponse}</pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardFooter>
            )}
          </Card>
        </motion.div>
      </main>

      <footer className="mt-12 py-6 border-t border-border/40 text-center text-sm text-muted-foreground">
        <div className="container mx-auto">
          <p>Générateur de Diagrammes par IA © {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  )
}

