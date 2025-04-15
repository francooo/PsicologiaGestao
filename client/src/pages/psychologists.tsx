import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useAuth } from "@/hooks/use-auth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { insertUserSchema, insertPsychologistSchema } from "@shared/schema";
import Sidebar from "@/components/sidebar";
import MobileNav from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Form, 
  FormControl, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Plus, Pencil, Trash2, UserCog, User } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

// Psychologist form schema
const psychologistFormSchema = z.object({
  fullName: z.string().min(1, "Nome completo é obrigatório"),
  email: z.string().email("Email inválido"),
  username: z.string().min(3, "Nome de usuário deve ter pelo menos 3 caracteres"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  specialization: z.string().min(1, "Especialização é obrigatória"),
  bio: z.string(),
  hourlyRate: z.string().refine((val) => !isNaN(parseFloat(val)), {
    message: "Valor deve ser um número válido",
  }),
  profileImage: z.string().optional(),
  role: z.string().default("psychologist"),
  status: z.string().default("active"),
});

type PsychologistFormValues = z.infer<typeof psychologistFormSchema>;

export default function Psychologists() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isNewPsychologistDialogOpen, setIsNewPsychologistDialogOpen] = useState(false);
  const [selectedPsychologist, setSelectedPsychologist] = useState<number | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [psychologistToDelete, setPsychologistToDelete] = useState<number | null>(null);

  // Fetch psychologists
  const { data: psychologists, isLoading } = useQuery({
    queryKey: ['/api/psychologists'],
    queryFn: async () => {
      const res = await fetch('/api/psychologists');
      if (!res.ok) throw new Error('Failed to fetch psychologists');
      return res.json();
    }
  });

  // Psychologist form
  const psychologistForm = useForm<PsychologistFormValues>({
    resolver: zodResolver(psychologistFormSchema),
    defaultValues: {
      fullName: "",
      email: "",
      username: "",
      password: "",
      specialization: "",
      bio: "",
      hourlyRate: "",
      profileImage: "",
      role: "psychologist",
      status: "active",
    }
  });

  // Create psychologist mutation
  const createPsychologistMutation = useMutation({
    mutationFn: async (data: PsychologistFormValues) => {
      try {
        // First create the user
        const userResponse = await apiRequest("POST", "/api/register", {
          fullName: data.fullName,
          email: data.email,
          username: data.username,
          password: data.password,
          role: data.role,
          status: data.status,
          profileImage: data.profileImage || undefined,
        });
        
        if (!userResponse.ok) {
          const error = await userResponse.json();
          throw new Error(error.message || 'Erro ao criar usuário');
        }
        
        const user = await userResponse.json();
        
        // Then create the psychologist profile
        const psychologistResponse = await apiRequest("POST", "/api/psychologists", {
          userId: user.id,
          specialization: data.specialization,
          bio: data.bio,
          hourlyRate: parseFloat(data.hourlyRate),
        });
        
        if (!psychologistResponse.ok) {
          const error = await psychologistResponse.json();
          throw new Error(error.message || 'Erro ao criar perfil da psicóloga');
        }
        
        return psychologistResponse.json();
      } catch (error) {
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/psychologists'] });
      toast({
        title: "Sucesso!",
        description: "A psicóloga foi cadastrada com sucesso no sistema.",
        variant: "default",
      });
      setIsNewPsychologistDialogOpen(false);
      psychologistForm.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Erro no cadastro",
        description: error.message || "Houve um erro ao cadastrar a psicóloga. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    }
  });
  
  // Delete psychologist mutation
  const deletePsychologistMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/psychologists/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/psychologists'] });
      toast({
        title: "Psicóloga removida",
        description: "A psicóloga foi removida com sucesso.",
        variant: "default",
      });
      setPsychologistToDelete(null);
      setIsDeleteDialogOpen(false);
    },
    onError: (error) => {
      toast({
        title: "Erro",
        description: `Falha ao remover psicóloga: ${error.message}`,
        variant: "destructive",
      });
    }
  });

  // Handle psychologist form submission
  const onPsychologistSubmit = (data: PsychologistFormValues) => {
    createPsychologistMutation.mutate(data);
  };

  // Handle delete confirmation
  const handleDeleteConfirm = () => {
    if (psychologistToDelete) {
      deletePsychologistMutation.mutate(psychologistToDelete);
    }
  };

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  return (
    <div className="flex h-screen bg-neutral-lightest">
      <Sidebar />
      
      <div className="flex-1 overflow-x-hidden ml-0 md:ml-64 pt-16 md:pt-0">
        <MobileNav />
        
        <main className="p-4 md:p-6 pb-20 md:pb-6">
          {/* Psychologists Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-neutral-darkest">Psicólogas</h1>
              <p className="text-neutral-dark">Gerenciamento de profissionais</p>
            </div>
            <div className="flex mt-4 md:mt-0">
              <Dialog open={isNewPsychologistDialogOpen} onOpenChange={setIsNewPsychologistDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="flex items-center">
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Psicóloga
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Nova Psicóloga</DialogTitle>
                    <DialogDescription>
                      Preencha os detalhes para adicionar uma nova psicóloga.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <Form {...psychologistForm}>
                    <form onSubmit={psychologistForm.handleSubmit(onPsychologistSubmit)} className="space-y-4 mt-4">
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-neutral-dark border-b pb-2">Informações Pessoais</h3>
                        
                        <FormField
                          control={psychologistForm.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Nome Completo</FormLabel>
                              <FormControl>
                                <Input placeholder="Digite o nome completo" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={psychologistForm.control}
                            name="email"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                  <Input type="email" placeholder="email@exemplo.com" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={psychologistForm.control}
                            name="profileImage"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>URL da Foto de Perfil</FormLabel>
                                <FormControl>
                                  <Input placeholder="https://exemplo.com/foto.jpg" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-neutral-dark border-b pb-2">Credenciais de Acesso</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={psychologistForm.control}
                            name="username"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Nome de Usuário</FormLabel>
                                <FormControl>
                                  <Input placeholder="username" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={psychologistForm.control}
                            name="password"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Senha</FormLabel>
                                <FormControl>
                                  <Input type="password" placeholder="********" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={psychologistForm.control}
                            name="role"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Função</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione uma função" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="psychologist">Psicóloga</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={psychologistForm.control}
                            name="status"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Status</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione o status" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="active">Ativo</SelectItem>
                                    <SelectItem value="inactive">Inativo</SelectItem>
                                    <SelectItem value="pending">Pendente</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <h3 className="text-sm font-medium text-neutral-dark border-b pb-2">Informações Profissionais</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <FormField
                            control={psychologistForm.control}
                            name="specialization"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Especialização</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: Terapia Cognitivo-Comportamental" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          
                          <FormField
                            control={psychologistForm.control}
                            name="hourlyRate"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Valor da Hora</FormLabel>
                                <FormControl>
                                  <Input placeholder="Ex: 150.00" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>
                        
                        <FormField
                          control={psychologistForm.control}
                          name="bio"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Biografia</FormLabel>
                              <FormControl>
                                <Textarea 
                                  placeholder="Descreva a experiência e formação da profissional" 
                                  className="resize-none min-h-[100px]" 
                                  {...field} 
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      
                      <DialogFooter>
                        <Button type="submit" disabled={createPsychologistMutation.isPending}>
                          {createPsychologistMutation.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Criando...
                            </>
                          ) : (
                            "Adicionar Psicóloga"
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Psychologists Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {psychologists && psychologists.length > 0 ? (
                  psychologists.map((psychologist) => (
                    <Card key={psychologist.id} className="overflow-hidden">
                      <CardHeader className="pb-3">
                        <div className="flex items-center">
                          <div className="relative mr-4">
                            <img 
                              src={psychologist.user.profileImage || "https://via.placeholder.com/80"} 
                              alt={psychologist.user.fullName} 
                              className="w-16 h-16 rounded-full object-cover border-2 border-primary"
                            />
                            <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                              psychologist.user.status === 'active' ? 'bg-green-500' : 
                              psychologist.user.status === 'pending' ? 'bg-yellow-500' : 'bg-gray-400'
                            }`}></span>
                          </div>
                          <div>
                            <CardTitle className="text-lg">{psychologist.user.fullName}</CardTitle>
                            <CardDescription>{psychologist.specialization}</CardDescription>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="pb-4">
                        <div className="mb-4">
                          <p className="text-sm text-neutral-dark line-clamp-3">
                            {psychologist.bio || "Nenhuma biografia disponível."}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="flex items-center gap-1 text-neutral-dark">
                            <User className="h-4 w-4" />
                            <span>{psychologist.user.username}</span>
                          </div>
                          <div className="flex items-center gap-1 text-neutral-dark">
                            <UserCog className="h-4 w-4" />
                            <span className="capitalize">{psychologist.user.role}</span>
                          </div>
                          <div className="flex items-center gap-1 text-neutral-dark col-span-2">
                            <span className="font-medium">Valor/hora:</span>
                            <span className="text-green-600 font-medium">
                              {formatCurrency(parseFloat(psychologist.hourlyRate.toString()))}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="pt-0 flex justify-between">
                        <Button variant="outline" size="sm">
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </Button>
                        
                        <AlertDialog open={isDeleteDialogOpen && psychologistToDelete === psychologist.id} onOpenChange={setIsDeleteDialogOpen}>
                          <AlertDialogTrigger asChild>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => setPsychologistToDelete(psychologist.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Remover
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja remover esta psicóloga? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel onClick={() => setPsychologistToDelete(null)}>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={handleDeleteConfirm}>
                                {deletePsychologistMutation.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  "Confirmar"
                                )}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </CardFooter>
                    </Card>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12 text-neutral-dark">
                    <User className="h-12 w-12 mx-auto text-neutral-light mb-4" />
                    <h3 className="text-lg font-medium mb-2">Nenhuma psicóloga cadastrada</h3>
                    <p className="max-w-md mx-auto mb-6">
                      Adicione psicólogas para começar a gerenciar consultas e agendamentos.
                    </p>
                    <Button
                      onClick={() => setIsNewPsychologistDialogOpen(true)}
                      className="flex items-center mx-auto"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Psicóloga
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
