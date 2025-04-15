import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import Sidebar from "@/components/sidebar";
import MobileNav from "@/components/mobile-nav";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
} from 'recharts';
import { Input } from "@/components/ui/input";
import { 
  Loader2, 
  FileDown, 
  Filter, 
  ArrowUp, 
  ArrowDown, 
  Calendar, 
  BarChart3
} from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function CashFlow() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [dateRange, setDateRange] = useState<{startDate: string, endDate: string}>(() => {
    const today = new Date();
    const startDate = startOfMonth(today);
    const endDate = endOfMonth(today);
    return {
      startDate: format(startDate, 'yyyy-MM-dd'),
      endDate: format(endDate, 'yyyy-MM-dd')
    };
  });
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<string>("all");

  // Fetch transactions with date range
  const { 
    data: transactions, 
    isLoading,
    isError
  } = useQuery({
    queryKey: ['/api/transactions', dateRange],
    queryFn: async () => {
      const res = await fetch(`/api/transactions?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`);
      if (!res.ok) throw new Error('Failed to fetch transactions');
      return res.json();
    }
  });

  // Define income and expense categories for filtering
  const incomeCategories = [
    'Consulta',
    'Avaliação',
    'Sessão em Grupo',
    'Workshop',
    'Outro'
  ];

  const expenseCategories = [
    'Aluguel',
    'Água',
    'Luz',
    'Internet',
    'Material de Escritório',
    'Limpeza',
    'Manutenção',
    'Salários',
    'Marketing',
    'Impostos',
    'Outro'
  ];

  // Combined categories for filtering
  const allCategories = [...incomeCategories, ...expenseCategories];

  // Calculate financial summary
  const calculateSummary = () => {
    if (!transactions || transactions.length === 0) {
      return {
        totalIncome: 0,
        totalExpense: 0,
        balance: 0,
        formattedIncome: 'R$ 0,00',
        formattedExpense: 'R$ 0,00',
        formattedBalance: 'R$ 0,00',
        incomeByCategory: {},
        expenseByCategory: {},
        incomeByCategoryArray: [],
        expenseByCategoryArray: []
      };
    }

    // Filter transactions based on selected type
    const filteredTransactions = transactions.filter(t => {
      if (selectedType === "all") return true;
      return t.type === selectedType;
    });

    // Calculate totals
    const totalIncome = filteredTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Number(t.amount), 0);
      
    const totalExpense = filteredTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Number(t.amount), 0);
      
    const balance = totalIncome - totalExpense;

    // Format for display
    const formatter = new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });

    // Calculate income by category
    const incomeByCategory: Record<string, number> = {};
    filteredTransactions
      .filter(t => t.type === 'income')
      .forEach(t => {
        const category = t.category || 'Sem categoria';
        incomeByCategory[category] = (incomeByCategory[category] || 0) + Number(t.amount);
      });

    // Calculate expense by category
    const expenseByCategory: Record<string, number> = {};
    filteredTransactions
      .filter(t => t.type === 'expense')
      .forEach(t => {
        const category = t.category || 'Sem categoria';
        expenseByCategory[category] = (expenseByCategory[category] || 0) + Number(t.amount);
      });

    // Transform to array for charts
    const incomeByCategoryArray = Object.entries(incomeByCategory).map(([name, value]) => ({
      name,
      value
    }));

    const expenseByCategoryArray = Object.entries(expenseByCategory).map(([name, value]) => ({
      name,
      value
    }));

    return {
      totalIncome,
      totalExpense,
      balance,
      formattedIncome: formatter.format(totalIncome),
      formattedExpense: formatter.format(totalExpense),
      formattedBalance: formatter.format(balance),
      incomeByCategory,
      expenseByCategory,
      incomeByCategoryArray,
      expenseByCategoryArray
    };
  };

  // Process data for daily cash flow chart
  const prepareDailyFlowData = () => {
    if (!transactions || transactions.length === 0) {
      return [];
    }

    // Get all unique dates within range
    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);
    
    const dateMap = new Map();
    
    // Initialize all dates in range with zero values
    let currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = format(currentDate, 'yyyy-MM-dd');
      dateMap.set(dateStr, { date: dateStr, income: 0, expense: 0, balance: 0 });
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Fill in actual transaction data
    transactions.forEach(transaction => {
      const transactionDate = format(new Date(transaction.date), 'yyyy-MM-dd');
      
      if (dateMap.has(transactionDate)) {
        const existingData = dateMap.get(transactionDate);
        
        if (transaction.type === 'income') {
          existingData.income += Number(transaction.amount);
        } else if (transaction.type === 'expense') {
          existingData.expense += Number(transaction.amount);
        }
        
        existingData.balance = existingData.income - existingData.expense;
        dateMap.set(transactionDate, existingData);
      }
    });
    
    // Convert map to array and sort by date
    const dailyData = Array.from(dateMap.values());
    dailyData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Format dates for display
    return dailyData.map(item => ({
      ...item,
      displayDate: format(new Date(item.date), 'dd/MM')
    }));
  };

  // Filter transactions based on selected categories and type
  const getFilteredTransactions = () => {
    if (!transactions) return [];
    
    return transactions.filter(transaction => {
      // Apply type filter
      if (selectedType !== "all" && transaction.type !== selectedType) {
        return false;
      }
      
      // Apply category filter if any categories are selected
      if (selectedCategories.length > 0 && !selectedCategories.includes(transaction.category)) {
        return false;
      }
      
      return true;
    });
  };

  // Calculate data for summary
  const summary = calculateSummary();
  const dailyFlowData = prepareDailyFlowData();
  const filteredTransactions = getFilteredTransactions();

  // Formatting helpers
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy');
  };

  // For category pie charts
  const COLORS = [
    '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#A569BD', 
    '#5DADE2', '#45B39D', '#F4D03F', '#EB984E', '#EC7063'
  ];

  const RADIAN = Math.PI / 180;
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-screen bg-neutral-lightest">
        <Sidebar />
        <div className="flex-1 overflow-x-hidden ml-0 md:ml-64 pt-16 md:pt-0">
          <MobileNav />
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-neutral-lightest">
      <Sidebar />
      
      <div className="flex-1 overflow-x-hidden overflow-y-auto ml-0 md:ml-64 pt-16 md:pt-0">
        <MobileNav />
        
        <main className="p-4 md:p-6 pb-20 md:pb-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-neutral-darkest">Fluxo de Caixa</h1>
              <p className="text-neutral-dark">Análise detalhada das receitas e despesas</p>
            </div>
            <div className="flex mt-4 md:mt-0 space-x-2">
              <Button variant="outline" onClick={() => navigate("/financial")}>
                <BarChart3 className="mr-2 h-4 w-4" />
                Voltar ao Financeiro
              </Button>
              <Button>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar Relatório
              </Button>
            </div>
          </div>
          
          {/* Filter Controls */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Filtros</CardTitle>
              <CardDescription>Selecione o período e categorias para análise</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex items-center space-x-2">
                  <div className="flex flex-col">
                    <span className="text-sm text-neutral-dark mb-1">De:</span>
                    <Input 
                      type="date" 
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange({...dateRange, startDate: e.target.value})}
                      className="w-36"
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm text-neutral-dark mb-1">Até:</span>
                    <Input 
                      type="date" 
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange({...dateRange, endDate: e.target.value})}
                      className="w-36"
                    />
                  </div>
                </div>
                
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex flex-col w-full md:w-40">
                    <span className="text-sm text-neutral-dark mb-1">Tipo:</span>
                    <Select value={selectedType} onValueChange={setSelectedType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="income">Receitas</SelectItem>
                        <SelectItem value="expense">Despesas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <Button variant="outline" className="flex items-center">
                    <Filter className="mr-2 h-4 w-4" />
                    Mais Filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <ArrowDown className="h-5 w-5 mr-2 text-blue-500" />
                  Entradas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">{summary.formattedIncome}</p>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <ArrowUp className="h-5 w-5 mr-2 text-red-500" />
                  Saídas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{summary.formattedExpense}</p>
              </CardContent>
            </Card>
            
            <Card className={`bg-gradient-to-br ${summary.balance >= 0 ? 'from-green-50 to-green-100 border-green-200' : 'from-orange-50 to-orange-100 border-orange-200'}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Calendar className={`h-5 w-5 mr-2 ${summary.balance >= 0 ? 'text-green-500' : 'text-orange-500'}`} />
                  Saldo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${summary.balance >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                  {summary.formattedBalance}
                </p>
              </CardContent>
            </Card>
          </div>
          
          {/* Charts Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Daily Flow Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Fluxo Diário</CardTitle>
                <CardDescription>Entradas e saídas por dia no período selecionado</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80 w-full">
                  {dailyFlowData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={dailyFlowData}
                        margin={{ top: 5, right: 20, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.1} />
                        <XAxis dataKey="displayDate" />
                        <YAxis tickFormatter={(value) => `R$ ${value}`} />
                        <Tooltip
                          formatter={(value, name) => {
                            const label = name === 'income' 
                              ? 'Receitas' 
                              : name === 'expense' 
                                ? 'Despesas' 
                                : 'Saldo';
                            return [formatCurrency(Number(value)), label];
                          }}
                          labelFormatter={(label) => `Data: ${label}`}
                        />
                        <Legend formatter={(value) => {
                          return value === 'income' 
                            ? 'Receitas' 
                            : value === 'expense' 
                              ? 'Despesas' 
                              : 'Saldo';
                        }} />
                        <Bar dataKey="income" fill="#4CAF50" name="income" />
                        <Bar dataKey="expense" fill="#F44336" name="expense" />
                        <Bar dataKey="balance" fill="#2196F3" name="balance" />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-neutral-dark">Sem dados para exibir</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
            
            {/* Category Distribution Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Income by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Receitas por Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-40 w-full">
                    {summary.incomeByCategoryArray.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={summary.incomeByCategoryArray}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderCustomizedLabel}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {summary.incomeByCategoryArray.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-neutral-dark">Sem dados para exibir</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Expense by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Despesas por Categoria</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-40 w-full">
                    {summary.expenseByCategoryArray.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={summary.expenseByCategoryArray}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={renderCustomizedLabel}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {summary.expenseByCategoryArray.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <p className="text-neutral-dark">Sem dados para exibir</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
          
          {/* Transactions List */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Transações Detalhadas</CardTitle>
              <CardDescription>Lista completa de todas as transações no período</CardDescription>
            </CardHeader>
            <CardContent>
              {filteredTransactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Categoria</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead className="text-right">Valor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTransactions.map((transaction) => (
                        <TableRow key={transaction.id}>
                          <TableCell>{formatDate(transaction.date)}</TableCell>
                          <TableCell>{transaction.description}</TableCell>
                          <TableCell>{transaction.category}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              transaction.type === 'income' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {transaction.type === 'income' ? 'Receita' : 'Despesa'}
                            </span>
                          </TableCell>
                          <TableCell className={`text-right font-medium ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {formatCurrency(Number(transaction.amount))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-neutral-dark">Nenhuma transação encontrada no período selecionado.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}