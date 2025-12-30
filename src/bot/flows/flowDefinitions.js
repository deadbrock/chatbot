/**
 * Definições Completas dos Fluxos de Conversação
 * Baseado no diagrama Draw.io fornecido pelo cliente
 */

const flows = {
  /**
   * FLUXO INICIAL - Verificação de horário e boas-vindas
   */
  initial: {
    id: 'initial',
    name: 'Início do Contato',
    
    steps: {
      start: {
        action: 'check_business_hours',
        onSuccess: 'welcome_message',
        onFail: 'out_of_hours_message'
      },
      
      welcome_message: {
        message: (name) => `Olá ${name ? name : ''} 😊, seja bem vindo(a) ao atendimento da *FG SERVICES*\n_Excelência para quem faz com excelência_`,
        next: 'ask_name'
      },
      
      ask_name: {
        condition: (session) => !session.name,
        message: 'Como posso te chamar?',
        collect: 'name',
        next: 'main_menu'
      },
      
      out_of_hours_message: {
        message: (nextOpen) => `Olá 😊, seja bem vindo(a) ao atendimento da *FG SERVICES*\n_Excelência para quem faz com excelência_\n\n⏰ No momento estamos fora do horário de atendimento.\n\n📅 Nosso horário:\n• 8h às 12h\n• 13h às 17h\n• Segunda a Sexta\n\n${nextOpen ? `Retornaremos: ${nextOpen}` : ''}\n\nDeixe sua mensagem que retornaremos assim que possível! 📝`,
        next: 'collect_offline_message'
      },
      
      collect_offline_message: {
        collect: 'offline_message',
        next: 'end_conversation'
      }
    }
  },

  /**
   * MENU PRINCIPAL
   */
  main_menu: {
    id: 'main_menu',
    name: 'Menu Principal',
    
    message: `Selecione a opção que indica seu perfil:\n\n1️⃣ Sou Cliente\n2️⃣ Quero ser cliente\n3️⃣ Colaborador\n4️⃣ Atual fornecedor\n5️⃣ Quero ser fornecedor\n6️⃣ Trabalhe Conosco\n7️⃣ Outros`,
    
    options: {
      '1': {
        label: 'Sou Cliente',
        next: 'client_flow',
        action: 'collect_client_data'
      },
      '2': {
        label: 'Quero ser cliente',
        next: 'prospect_flow',
        action: 'collect_prospect_data'
      },
      '3': {
        label: 'Colaborador',
        next: 'employee_flow'
      },
      '4': {
        label: 'Atual fornecedor',
        next: 'supplier_flow'
      },
      '5': {
        label: 'Quero ser fornecedor',
        next: 'prospect_supplier_flow'
      },
      '6': {
        label: 'Trabalhe Conosco',
        action: 'send_job_link'
      },
      '7': {
        label: 'Outros',
        next: 'transfer_to_agent'
      }
    }
  },

  /**
   * FLUXO CLIENTE (Opção 1)
   */
  client_flow: {
    id: 'client_flow',
    name: 'Sou Cliente',
    
    steps: {
      collect_data: {
        messages: [
          'Para agilizar o atendimento, compartilhe por gentileza os dados:',
          '',
          '📝 Nome',
          '📞 Telefone',
          '📧 Email',
          '🏢 Qual contrato'
        ],
        collect: ['name', 'phone', 'email', 'contract'],
        next: 'client_menu'
      },
      
      client_menu: {
        message: `Como a *FG SERVICES* pode ajudar você hoje?\n\n1️⃣ Assuntos Administrativos\n2️⃣ Comercial\n3️⃣ Operacional\n4️⃣ Voltar ao menu anterior`,
        
        options: {
          '1': { next: 'administrative_menu' },
          '2': { next: 'commercial_menu' },
          '3': { next: 'operational_menu' },
          '4': { next: 'main_menu' }
        }
      }
    }
  },

  /**
   * MENU ADMINISTRATIVO
   */
  administrative_menu: {
    id: 'administrative_menu',
    name: 'Assuntos Administrativos',
    
    message: `Digite 👇🏽\n\n1️⃣ Departamento Pessoal\n2️⃣ Financeiro\n3️⃣ Compras\n4️⃣ Manutenção\n5️⃣ Logística\n6️⃣ RH\n7️⃣ Segurança do Trabalho\n8️⃣ Faturamento\n9️⃣ Gerência Administrativa\n🔟 Diretoria\n1️⃣1️⃣ Operacional\n1️⃣2️⃣ Voltar ao menu anterior`,
    
    options: {
      '1': { next: 'dp_menu' },
      '2': { next: 'financial_menu' },
      '3': { next: 'purchasing_menu' },
      '4': { next: 'maintenance_menu' },
      '5': { next: 'logistics_menu' },
      '6': { next: 'hr_menu' },
      '7': { next: 'safety_menu' },
      '8': { next: 'billing_menu' },
      '9': { next: 'management_menu' },
      '10': { next: 'board_menu' },
      '11': { next: 'operational_menu' },
      '12': { next: 'client_menu' }
    }
  },

  /**
   * DEPARTAMENTO PESSOAL
   */
  dp_menu: {
    id: 'dp_menu',
    name: 'Departamento Pessoal',
    
    steps: {
      profile_selection: {
        message: `Digite 👇🏽\n\n1️⃣ Colaborador\n2️⃣ Ex colaborador\n3️⃣ Voltar ao menu anterior`,
        
        options: {
          '1': { next: 'dp_employee_menu' },
          '2': { next: 'dp_ex_employee_menu' },
          '3': { next: 'administrative_menu' }
        }
      },
      
      dp_employee_menu: {
        message: `Digite 👇🏽\n\n1️⃣ Admissões\n2️⃣ Benefícios\n3️⃣ Férias\n4️⃣ Afastamentos\n5️⃣ Rescisões\n6️⃣ Outros\n7️⃣ Folha de Pagamento\n8️⃣ Encargos\n9️⃣ Voltar ao menu anterior`,
        
        options: {
          '1': { action: 'transfer_to_agent', department: 'DP' },
          '2': { next: 'benefits_menu' },
          '3': { action: 'transfer_to_agent', department: 'DP' },
          '4': { next: 'leave_menu' },
          '5': { next: 'termination_flow' },
          '6': { action: 'transfer_to_agent', department: 'DP' },
          '7': { action: 'transfer_to_agent', department: 'DP' },
          '8': { action: 'transfer_to_agent', department: 'DP' },
          '9': { next: 'profile_selection' }
        }
      }
    }
  },

  /**
   * BENEFÍCIOS
   */
  benefits_menu: {
    id: 'benefits_menu',
    name: 'Benefícios',
    
    message: `Digite 👇🏽\n\n1️⃣ Vale Alimentação\n2️⃣ Vale Refeição\n3️⃣ Plano de saúde\n4️⃣ Plano odontológico\n5️⃣ Outros\n6️⃣ Voltar ao menu anterior`,
    
    options: {
      '1': { action: 'transfer_to_agent', department: 'DP - Benefícios' },
      '2': { action: 'transfer_to_agent', department: 'DP - Benefícios' },
      '3': { action: 'transfer_to_agent', department: 'DP - Benefícios' },
      '4': { action: 'transfer_to_agent', department: 'DP - Benefícios' },
      '5': { action: 'transfer_to_agent', department: 'DP - Benefícios' },
      '6': { next: 'dp_employee_menu' }
    }
  },

  /**
   * AFASTAMENTOS
   */
  leave_menu: {
    id: 'leave_menu',
    name: 'Afastamentos',
    
    message: `Digite 👇🏽\n\n1️⃣ Licença Maternidade/Paternidade\n2️⃣ Afastamento por doença\n3️⃣ Afastamento por acidente no trabalho\n4️⃣ Outros\n5️⃣ Voltar ao menu anterior`,
    
    options: {
      '1': { action: 'transfer_to_agent', department: 'DP - Afastamentos' },
      '2': { action: 'transfer_to_agent', department: 'DP - Afastamentos' },
      '3': { action: 'transfer_to_agent', department: 'DP - Afastamentos' },
      '4': { action: 'transfer_to_agent', department: 'DP - Afastamentos' },
      '5': { next: 'dp_employee_menu' }
    }
  },

  /**
   * RESCISÃO
   */
  termination_flow: {
    id: 'termination_flow',
    name: 'Rescisão',
    
    steps: {
      collect_info: {
        message: 'Para agilizar o atendimento, nos informe por gentileza seu nome e CPF.',
        collect: ['name', 'cpf'],
        next: 'transfer_to_agent'
      }
    }
  },

  /**
   * MANUTENÇÃO
   */
  maintenance_menu: {
    id: 'maintenance_menu',
    name: 'Manutenção',
    
    steps: {
      service_type: {
        message: `Digite 👇🏽\n\n1️⃣ Abrir chamados\n2️⃣ Dúvidas Técnicas\n3️⃣ Solicitação de peças\n4️⃣ Voltar ao menu anterior`,
        
        options: {
          '1': { next: 'open_ticket' },
          '2': { next: 'technical_doubts' },
          '3': { next: 'parts_request' },
          '4': { next: 'administrative_menu' }
        }
      },
      
      open_ticket: {
        message: `Digite o modelo do equipamento?\n\n1️⃣ Enceradeira\n2️⃣ Lavadora de piso\n3️⃣ Roçadeira\n4️⃣ Aspirador\n5️⃣ Polidora\n6️⃣ Varredeira\n7️⃣ Voltar ao menu anterior`,
        
        collect: 'equipment_type',
        options: {
          '1': { value: 'Enceradeira', next: 'collect_ticket_details' },
          '2': { value: 'Lavadora de piso', next: 'collect_ticket_details' },
          '3': { value: 'Roçadeira', next: 'collect_ticket_details' },
          '4': { value: 'Aspirador', next: 'collect_ticket_details' },
          '5': { value: 'Polidora', next: 'collect_ticket_details' },
          '6': { value: 'Varredeira', next: 'collect_ticket_details' },
          '7': { next: 'service_type' }
        }
      },
      
      collect_ticket_details: {
        messages: [
          'Informe por favor seu cargo?',
          'Agora, sua loja/contrato?',
          'Endereço completo'
        ],
        collect: ['position', 'store', 'address'],
        next: 'send_ticket_form'
      },
      
      send_ticket_form: {
        message: `Para atender sua solicitação, preencha o formulário clicando no link:\n\n🔗 https://docs.google.com/forms/d/e/1FAIpQLScM3Q5-ibvBMmrMZweuJAPs28ZBF466YHElITQhGLgQBrAkZA/viewform?usp=dialog\n\n_Todos os campos solicitados são obrigatórios, caso não sejam preenchidos, a solicitação será encerrada._`,
        next: 'confirm_form_submission'
      },
      
      confirm_form_submission: {
        message: 'Você preencheu o formulário com as informações solicitadas?',
        options: {
          'sim': { next: 'wait_for_agent' },
          'positivo': { next: 'wait_for_agent' },
          'sim': { next: 'wait_for_agent' },
          'não': { next: 'form_not_filled' },
          'nao': { next: 'form_not_filled' }
        }
      },
      
      form_not_filled: {
        message: 'Como os dados não foram preenchidos, não conseguimos registrar a sua solicitação, *essa conversa será encerrada*, mas assim que conseguir as informações, pode nos chamar!',
        next: 'nps_evaluation'
      },
      
      technical_doubts: {
        message: `Digite o modelo do equipamento?\n\n1️⃣ Enceradeira\n2️⃣ Lavadora de piso\n3️⃣ Roçadeira\n4️⃣ Aspirador\n5️⃣ Polidora\n6️⃣ Varredeira\n7️⃣ Voltar ao menu anterior`,
        
        collect: 'equipment_type',
        next: 'collect_doubt_description'
      },
      
      collect_doubt_description: {
        message: 'Digite um breve resumo sobre sua dúvida',
        collect: 'doubt_description',
        next: 'wait_for_agent'
      },
      
      parts_request: {
        message: `Digite o modelo do equipamento?\n\n1️⃣ Enceradeira\n2️⃣ Lavadora de piso\n3️⃣ Roçadeira\n4️⃣ Aspirador\n5️⃣ Polidora\n6️⃣ Varredeira\n7️⃣ Outros\n8️⃣ Voltar ao menu anterior`,
        
        collect: 'equipment_type',
        next: 'collect_manufacturer'
      },
      
      collect_manufacturer: {
        message: `Agora digite o fabricante:\n\nKarcher\nAlfa Tennant\nTfn\nVemac\nEscobras\nEcoclean\nDeep Clean\nCertec\nAll Clean\nRhomer\nCleaner\nThielle\nKawasaki\nKawashima\nSthill\nToyama\nVoltar ao menu anterior`,
        
        collect: 'manufacturer',
        next: 'describe_part'
      },
      
      describe_part: {
        message: 'Por favor compartilhe a descrição da peça solicitada ou envie uma foto para agilizar o atendimento',
        collect: 'part_description',
        next: 'wait_for_agent'
      }
    }
  },

  /**
   * COMPRAS
   */
  purchasing_menu: {
    id: 'purchasing_menu',
    name: 'Compras',
    
    message: `Digite 👇🏽\n\n1️⃣ Compras\n2️⃣ Pedidos (Materiais)\n3️⃣ Voltar ao menu anterior`,
    
    options: {
      '1': { action: 'transfer_to_agent', department: 'Compras' },
      '2': { next: 'materials_request' },
      '3': { next: 'administrative_menu' }
    }
  },

  /**
   * PEDIDOS DE MATERIAIS
   */
  materials_request: {
    id: 'materials_request',
    name: 'Pedidos (Materiais)',
    
    steps: {
      select_region: {
        message: `Digite 👇🏽\n\n1️⃣ Região Metropolitana (*RECIFE*)\n2️⃣ Norte\n3️⃣ Nordeste\n4️⃣ Voltar ao menu anterior`,
        
        options: {
          '1': { value: 'Recife', next: 'select_contract' },
          '2': { value: 'Norte', next: 'select_contract' },
          '3': { value: 'Nordeste', next: 'select_contract' },
          '4': { next: 'purchasing_menu' }
        }
      },
      
      select_contract: {
        message: 'Qual contrato deseja realizar o pedido?',
        collect: 'contract',
        next: 'wait_for_agent'
      }
    }
  },

  /**
   * COLABORADOR (Opção 3 do Menu Principal)
   */
  employee_flow: {
    id: 'employee_flow',
    name: 'Colaborador',
    
    steps: {
      employee_type: {
        message: `Digite 👇🏽\n\n1️⃣ Colaborador\n2️⃣ Ex colaborador\n3️⃣ Voltar ao menu anterior`,
        
        options: {
          '1': { next: 'employee_options' },
          '2': { next: 'ex_employee_flow' },
          '3': { next: 'main_menu' }
        }
      },
      
      employee_options: {
        message: `Digite 👇🏽\n\n1️⃣ RDV\n2️⃣ Pagamentos de diárias\n3️⃣ Pagamentos de salários\n4️⃣ Voltar ao menu anterior`,
        
        options: {
          '1': { action: 'transfer_to_agent', department: 'Financeiro - RDV' },
          '2': { action: 'transfer_to_agent', department: 'Financeiro - Diárias' },
          '3': { action: 'transfer_to_agent', department: 'Financeiro - Salários' },
          '4': { next: 'employee_type' }
        }
      },
      
      ex_employee_flow: {
        action: 'transfer_to_agent',
        department: 'RH - Ex-colaborador'
      }
    }
  },

  /**
   * FORNECEDOR (Opção 4 do Menu Principal)
   */
  supplier_flow: {
    id: 'supplier_flow',
    name: 'Atual Fornecedor',
    
    steps: {
      supplier_menu: {
        message: `Digite 👇🏽\n\n1️⃣ Financeiro\n2️⃣-7️⃣ (Outros departamentos)\n8️⃣ Voltar ao menu anterior`,
        
        options: {
          '1': { next: 'supplier_financial' },
          '8': { next: 'main_menu' }
        }
      },
      
      supplier_financial: {
        message: `Digite 👇🏽\n\n1️⃣ Contas a pagar\n2️⃣ Contas a receber\n3️⃣ Voltar ao menu anterior`,
        
        options: {
          '1': { next: 'accounts_payable' },
          '2': { action: 'transfer_to_agent', department: 'Financeiro' },
          '3': { next: 'supplier_menu' }
        }
      },
      
      accounts_payable: {
        message: 'Para agilizar o atendimento, passe as informações:\n\nCNPJ\nNÚMERO DA NOTA FISCAL\nVENCIMENTO',
        collect: ['cnpj', 'invoice', 'due_date'],
        next: 'wait_for_agent'
      }
    }
  },

  /**
   * FATURAMENTO
   */
  billing_menu: {
    id: 'billing_menu',
    name: 'Faturamento',
    
    steps: {
      billing_hierarchy: {
        message: `Digite 👇🏽\n\n1️⃣ Encarregado\n2️⃣ Supervisor\n3️⃣ Coordenador\n4️⃣ Gerente Operacional\n5️⃣ Voltar ao menu anterior`,
        
        options: {
          '1': { next: 'billing_options' },
          '2': { next: 'billing_options' },
          '3': { next: 'billing_options' },
          '4': { next: 'billing_options' },
          '5': { next: 'administrative_menu' }
        }
      },
      
      billing_options: {
        message: `Digite 👇🏽\n\n1️⃣ Informações sobre faturamentos\n2️⃣ Comprovantes de Etanol\n3️⃣ Voltar ao menu anterior`,
        
        options: {
          '1': { action: 'transfer_to_agent', department: 'Faturamento' },
          '2': { action: 'transfer_to_agent', department: 'Faturamento - Etanol' },
          '3': { next: 'billing_hierarchy' }
        }
      }
    }
  },

  /**
   * RH
   */
  hr_menu: {
    id: 'hr_menu',
    name: 'RH',
    
    message: `_Neste departamento tratamos os assuntos relativos especificamente a *contratações e ouvidora*, caso queira atendimento a demais assuntos, volte ao menu anterior e escolha a opção Departamento Pessoal._\n\nDigite 👇🏽\n\n1️⃣ Colaborador\n2️⃣ Ex colaborador\n3️⃣ Voltar ao menu anterior`,
    
    options: {
      '1': { action: 'transfer_to_agent', department: 'RH' },
      '2': { action: 'transfer_to_agent', department: 'RH' },
      '3': { next: 'administrative_menu' }
    }
  },

  /**
   * SEGURANÇA DO TRABALHO
   */
  safety_menu: {
    id: 'safety_menu',
    name: 'Segurança do Trabalho',
    
    message: `Digite 👇🏽\n\n1️⃣ Colaborador\n2️⃣ Ex colaborador\n3️⃣ Voltar ao menu anterior`,
    
    options: {
      '1': { action: 'transfer_to_agent', department: 'Segurança do Trabalho' },
      '2': { action: 'transfer_to_agent', department: 'Segurança do Trabalho' },
      '3': { next: 'administrative_menu' }
    }
  },

  /**
   * GERÊNCIA ADMINISTRATIVA
   */
  management_menu: {
    id: 'management_menu',
    name: 'Gerência Administrativa',
    
    steps: {
      collect_info: {
        message: 'Para agilizar o atendimento, compartilhe por gentileza os dados:\n\nNome\nCPF\nEmail\nQual empresa representa',
        collect: ['name', 'cpf', 'email', 'company'],
        next: 'describe_request'
      },
      
      describe_request: {
        message: 'Faça um breve resumo sobre sua solicitação.',
        collect: 'request_description',
        next: 'wait_for_agent'
      }
    }
  },

  /**
   * TRABALHE CONOSCO (Opção 6)
   */
  job_application: {
    id: 'job_application',
    name: 'Trabalhe Conosco',
    
    message: `🎯 *TRABALHE CONOSCO*\n\nConheça a FG Services e candidate-se às nossas vagas:\n\n🔗 https://trabalhe-conosco.vercel.app/#nossa-historia\n\nBoa sorte! 🍀`,
    next: 'main_menu'
  },

  /**
   * TRANSFERÊNCIA PARA ATENDENTE
   */
  wait_for_agent: {
    id: 'wait_for_agent',
    name: 'Aguardando Atendente',
    
    message: 'Aguarde que nosso time já vai te atender 😊',
    action: 'transfer_to_human',
    next: 'agent_conversation'
  },

  /**
   * CONVERSA COM ATENDENTE
   */
  agent_conversation: {
    id: 'agent_conversation',
    name: 'Em Atendimento Humano',
    
    // Aguarda resolução
    waitForResolution: true,
    onResolved: 'nps_evaluation'
  },

  /**
   * AVALIAÇÃO NPS
   */
  nps_evaluation: {
    id: 'nps_evaluation',
    name: 'Avaliação',
    
    steps: {
      ask_rating: {
        message: '🤝 *Agradecemos o seu contato.*\n\nAgora, conta pra gente como você se sentiu neste atendimento digitando a sua nota de 0 a 10.',
        collect: 'nps_score',
        validate: (value) => {
          const num = parseInt(value);
          return num >= 0 && num <= 10;
        },
        next: 'farewell'
      },
      
      farewell: {
        message: '✨ *Até mais e conte com a FG SERVICES*',
        next: 'end_conversation'
      }
    }
  },

  /**
   * ENCERRAMENTO
   */
  end_conversation: {
    id: 'end_conversation',
    name: 'Conversa Encerrada',
    action: 'close_session'
  }
};

module.exports = flows;

