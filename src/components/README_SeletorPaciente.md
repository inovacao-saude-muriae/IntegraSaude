# SeletorPaciente - Solução Híbrida de Cadastro

## 📋 **Visão Geral**

Componente reutilizável que permite **buscar pacientes existentes** ou **cadastrar novos** sem sair do contexto do módulo atual.

### **Vantagens:**
- ✅ **Fonte única de dados** (evita duplicatas)
- ✅ **UX otimizada** (cadastro no contexto)
- ✅ **Código reutilizável** (mesmo componente em todos os módulos)
- ✅ **LGPD compliant** (dados centralizados)

---

## 🚀 **Como Usar**

### **1. Importar o Componente**

```javascript
import SeletorPaciente from "@/components/SeletorPaciente";
```

### **2. Adicionar ao Formulário**

```javascript
export default function MeuFormulario() {
  const [pacienteSelecionado, setPacienteSelecionado] = useState(null);

  return (
    <form>
      <SeletorPaciente
        label="Paciente"
        placeholder="Buscar por nome ou CPF..."
        required={true}
        value={pacienteSelecionado}
        onSelect={(paciente) => setPacienteSelecionado(paciente)}
      />
      
      {/* Outros campos do formulário */}
    </form>
  );
}
```

---

## 📝 **Props do Componente**

| Prop | Tipo | Padrão | Descrição |
|------|------|--------|-----------|
| `onSelect` | `function` | **Obrigatório** | Callback quando paciente é selecionado/cadastrado |
| `label` | `string` | `"Paciente"` | Label do campo |
| `placeholder` | `string` | `"Buscar por nome ou CPF..."` | Placeholder do input |
| `required` | `boolean` | `false` | Se o campo é obrigatório (mostra *) |
| `value` | `object` | `null` | Paciente já selecionado |
| `disabled` | `boolean` | `false` | Desabilita o componente |

---

## 💡 **Exemplos de Uso**

### **Exemplo 1: Regulação - Novo Pedido**

```javascript
// src/app/regulacao/NovoPedido.js
import { useState } from "react";
import SeletorPaciente from "@/components/SeletorPaciente";

export default function NovoPedido() {
  const [form, setForm] = useState({
    paciente: null,
    tipoExame: "",
    urgencia: "Verde",
    // ... outros campos
  });

  return (
    <div>
      <h2>Novo Pedido de Exame</h2>
      
      <SeletorPaciente
        label="Paciente"
        required={true}
        value={form.paciente}
        onSelect={(paciente) => {
          setForm(prev => ({
            ...prev,
            paciente,
            // Preenche outros campos automaticamente
            cpf: paciente?.cpf || "",
            nomePaciente: paciente?.nomeCompleto || "",
          }));
        }}
      />
      
      {/* Resto do formulário */}
    </div>
  );
}
```

### **Exemplo 2: Farmácia Judicial - Novo Paciente/Processo**

```javascript
// src/app/camara-tecnica/farmacia-judicial/NovoPaciente.js
import { useState } from "react";
import SeletorPaciente from "@/components/SeletorPaciente";

export default function NovoPaciente() {
  const [paciente, setPaciente] = useState(null);
  const [numeroProcesso, setNumeroProcesso] = useState("");

  const handleSalvar = async () => {
    if (!paciente) {
      alert("Selecione um paciente");
      return;
    }

    const payload = {
      cpfPaciente: paciente.cpf,
      numeroProcesso,
      // ... outros campos
    };

    // Salvar na API da Farmácia
  };

  return (
    <div>
      <h2>Cadastrar Paciente no Sistema Judicial</h2>
      
      <SeletorPaciente
        label="Paciente"
        placeholder="Buscar ou cadastrar paciente..."
        required={true}
        value={paciente}
        onSelect={setPaciente}
      />
      
      <label>
        Número do Processo
        <input
          type="text"
          value={numeroProcesso}
          onChange={(e) => setNumeroProcesso(e.target.value)}
        />
      </label>

      <button onClick={handleSalvar}>Salvar</button>
    </div>
  );
}
```

### **Exemplo 3: Junta Reguladora - Cadastro de Paciente para Serviço**

```javascript
// src/app/junta-reguladora/CadastroServico.js
import { useState } from "react";
import SeletorPaciente from "@/components/SeletorPaciente";

export default function CadastroServico() {
  const [form, setForm] = useState({
    paciente: null,
    servicoId: "",
    especialidadeId: "",
    observacoes: "",
  });

  return (
    <div>
      <h2>Cadastrar Paciente em Serviço</h2>
      
      <SeletorPaciente
        label="Paciente"
        required={true}
        value={form.paciente}
        onSelect={(paciente) => {
          setForm(prev => ({ ...prev, paciente }));
        }}
      />
      
      {/* Campos específicos do serviço */}
      <select
        value={form.servicoId}
        onChange={(e) => setForm(prev => ({ ...prev, servicoId: e.target.value }))}
      >
        <option value="">Selecione o serviço</option>
        <option value="CAEE">CAEE</option>
        <option value="APAE">APAE</option>
        <option value="AMBULATORIO">Ambulatório</option>
        <option value="ESPECIALIDADES">Centro de Especialidades</option>
      </select>
    </div>
  );
}
```

---

## 🔄 **Fluxo de Uso**

1. **Usuário digita** no campo de busca
2. **Sistema busca** pacientes na base centralizada (API `/api/pessoas/buscar`)
3. **Dropdown mostra** resultados encontrados
4. **Usuário escolhe**:
   - **Paciente existente**: Clica e seleciona
   - **Paciente novo**: Clica em "Cadastrar Novo Paciente"
5. **Modal abre** com formulário completo de cadastro
6. **Após salvar**: Paciente é selecionado automaticamente no formulário

---

## 📊 **Estrutura de Dados**

### **Objeto Paciente Retornado:**

```javascript
{
  cpf: "12345678900",
  nomeCompleto: "João da Silva",
  dataNascimento: "1990-01-01",
  telefone: "31999998888",
  sexo: "Masculino",
  nomeMae: "Maria da Silva",
  cns: "123456789012345",
  ubsReferenciaId: 1,
  // Campos de endereço não são retornados no autocomplete
  // mas estão no cadastro completo
}
```

---

## 🎨 **Estados Visuais**

### **1. Vazio (Aguardando busca)**
```
┌────────────────────────────────────┐
│ Buscar por nome ou CPF...         │
└────────────────────────────────────┘
[+ Cadastrar Novo Paciente]
```

### **2. Buscando**
```
┌────────────────────────────────────┐
│ João Silva                     ⏳ │
└────────────────────────────────────┘
```

### **3. Resultados Encontrados**
```
┌────────────────────────────────────┐
│ João Silva                         │
└────────────────────────────────────┘
┌────────────────────────────────────┐
│ 3 paciente(s) encontrado(s)        │
├────────────────────────────────────┤
│ João Silva Santos                  │
│ CPF: 123.456.789-00 • 01/01/1990  │
├────────────────────────────────────┤
│ João da Silva                      │
│ CPF: 987.654.321-00 • 15/05/1985  │
└────────────────────────────────────┘
```

### **4. Nenhum Resultado**
```
┌────────────────────────────────────┐
│        🔍                          │
│  Nenhum paciente encontrado        │
│  [+ Cadastrar Novo Paciente]       │
└────────────────────────────────────┘
```

### **5. Paciente Selecionado**
```
┌────────────────────────────────────┐
│ ✓ João da Silva                 [✕]│
│   CPF: 123.456.789-00              │
└────────────────────────────────────┘
```

---

## 🛠️ **APIs Criadas**

### **1. `/api/pessoas/buscar?termo=`**
- Busca pacientes por nome ou CPF
- Retorna até 10 resultados
- Autenticação obrigatória

### **2. `/api/ubs`**
- Lista todas as Unidades Básicas de Saúde
- Usado no formulário de cadastro
- Autenticação obrigatória

### **3. `/api/pessoas` (POST)**
- Cria novo paciente
- Valida CPF e campos obrigatórios
- Retorna paciente criado

---

## ✅ **Checklist de Implementação nos Módulos**

### **Regulação:**
- [ ] Novo Pedido - Adicionar SeletorPaciente
- [ ] Editar Pedido - Mostrar paciente selecionado

### **Farmácia Judicial:**
- [ ] Cadastro de Paciente - Adicionar SeletorPaciente
- [ ] Novo Processo - Adicionar SeletorPaciente

### **Junta Reguladora:**
- [ ] Cadastro de Paciente - Adicionar SeletorPaciente
- [ ] Cadastro em Serviços - Adicionar SeletorPaciente

---

## 🎯 **Próximos Passos**

1. Implementar o componente em cada módulo
2. Testar o fluxo completo (busca + cadastro)
3. Ajustar labels e placeholders conforme contexto
4. Adicionar validações específicas se necessário

---

## 📞 **Suporte**

Se tiver dúvidas sobre como usar o componente, verifique os exemplos acima ou consulte o código-fonte em:
- `src/components/SeletorPaciente.js`
- `src/components/ModalCadastroPaciente.js`
