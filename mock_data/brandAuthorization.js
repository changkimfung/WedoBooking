/**
 * 品牌授权文件 Mock 数据（仓储中台维护）
 */
var MOCK_BRAND_AUTH_LIST = [
  {
    id: 'brand-auth-mqt6agq9fn5v',
    brandCode: 'BA0007',
    customerCode: 'CN0000438',
    brandName: '宝马',
    expireDate: '2026-12-31',
    remark: '示例备注',
    authorizedProducts: [],
    authFiles: [
      {
        fileName: 'CPSC-Guidance-and-HTS-List-for-Filing-of-Electronic-Certificates-6B-Cleared.pdf',
        url: '/mock_data/uploads/brand-auth-files/BA0007_1782372228293_u6d4.pdf',
        uploadedAt: '2026-06-25 15:23:48'
      }
    ],
    operationLogs: [
      {
        id: 'brand-auth-log-mqt6ek31ppv',
        time: '2026-06-25 15:23:46',
        operator: '演示用户',
        action: '编辑',
        changes: [
          {
            field: '授权书文件',
            before: '空',
            after: 'CPSC-Guidance-and-HTS-List-for-Filing-of-Electronic-Certificates-6B-Cleared.pdf'
          }
        ]
      },
      {
        id: 'brand-auth-log-mqt6agq9df8',
        time: '2026-06-25 15:20:35',
        operator: '演示用户',
        action: '新增',
        changes: [
          {
            field: '客户编码',
            before: '',
            after: 'CN0000438'
          },
          {
            field: '品牌名称',
            before: '',
            after: '宝马'
          },
          {
            field: '授权有效期',
            before: '',
            after: '2026-12-31'
          },
          {
            field: '授权书文件',
            before: '',
            after: '空'
          },
          {
            field: '备注',
            before: '',
            after: '示例备注'
          }
        ]
      }
    ],
    createTime: '2026-06-25 15:20:35',
    updateTime: '2026-06-25 15:23:48'
  },
  {
    id: 'brand-auth-mqt5bxzmpihj',
    brandCode: 'BA0006',
    customerCode: 'cn00000765',
    brandName: 'HSIA',
    remark: '自有品牌',
    expireDate: '',
    authorizedProducts: [],
    authFiles: [],
    operationLogs: [
      {
        id: 'brand-auth-log-mqt5bxzmp4v',
        time: '2026-06-25 14:53:45',
        operator: '演示用户',
        action: '新增',
        changes: [
          {
            field: '客户编码',
            before: '',
            after: 'cn00000765'
          },
          {
            field: '品牌名称',
            before: '',
            after: 'HSIA'
          },
          {
            field: '授权有效期',
            before: '',
            after: ''
          },
          {
            field: '授权书文件',
            before: '',
            after: '空'
          },
          {
            field: '备注',
            before: '',
            after: '自有品牌'
          }
        ]
      }
    ],
    createTime: '2026-06-25 14:53:45',
    updateTime: '2026-06-25 15:23:48'
  },
  {
    id: 'brand-auth-mqrtgs90b9te',
    brandCode: 'BA0005',
    customerCode: 'CN0000438',
    brandName: '保时捷',
    expireDate: '2026-07-09',
    authorizedProducts: [
      '202662433'
    ],
    authFiles: [],
    operationLogs: [
      {
        id: 'brand-auth-log-mqrww1bjrx2',
        time: '2026-06-24 18:09:40',
        operator: '演示用户',
        action: '编辑',
        changes: [
          {
            field: '备注',
            before: '',
            after: '12312312312312312313'
          }
        ]
      },
      {
        id: 'brand-auth-log-mqrtgs917om',
        time: '2026-06-24 16:33:49',
        operator: '演示用户',
        action: '新增',
        changes: [
          {
            field: '客户编码',
            before: '',
            after: 'CN0000438'
          },
          {
            field: '品牌名称',
            before: '',
            after: '保时捷'
          },
          {
            field: '授权有效期',
            before: '',
            after: '2026-07-09'
          },
          {
            field: '授权书文件',
            before: '',
            after: '空'
          }
        ]
      }
    ],
    createTime: '2026-06-24 16:33:49',
    updateTime: '2026-06-25 15:23:48',
    remark: '12312312312312312313'
  },
  {
    id: 'brand-auth-mqrrozs68fpg',
    brandCode: 'BA0004',
    customerCode: 'CN0000438',
    brandName: '奔驰',
    expireDate: '2026-07-24',
    authorizedProducts: [
      '202662433'
    ],
    authFiles: [
      {
        fileName: 'image.png',
        url: 'http://localhost:3847/mock_data/uploads/brand-auth-files/BA0004_1782287053363_he9y.png',
        uploadedAt: '2026-06-24 15:44:13'
      },
      {
        fileName: '退件认领操作说明.docx',
        url: 'http://localhost:3847/mock_data/uploads/brand-auth-files/BA0004_1782289252460_k3nr.docx',
        uploadedAt: '2026-06-24 16:20:52'
      }
    ],
    operationLogs: [
      {
        id: 'brand-auth-log-mqrt1oug33n',
        time: '2026-06-24 16:22:05',
        operator: '演示用户',
        action: '编辑',
        changes: [
          {
            field: '授权有效期',
            before: '2026-07-03',
            after: '2026-07-24'
          }
        ]
      },
      {
        id: 'brand-auth-log-mqrt049obyq',
        time: '2026-06-24 16:20:51',
        operator: '演示用户',
        action: '编辑',
        changes: [
          {
            field: '授权书文件',
            before: 'image.png',
            after: 'image.png、退件认领操作说明.docx'
          }
        ]
      },
      {
        id: 'brand-auth-log-mqrru0bl8r6',
        time: '2026-06-24 15:48:07',
        operator: '演示用户',
        action: '编辑',
        changes: [
          {
            field: '授权有效期',
            before: '2026-06-30',
            after: '2026-07-03'
          }
        ]
      },
      {
        id: 'brand-auth-log-mqrrozs60rs',
        time: '2026-06-24 15:44:13',
        operator: '演示用户',
        action: '新增',
        changes: [
          {
            field: '客户编码',
            before: '',
            after: 'CN0000438'
          },
          {
            field: '品牌名称',
            before: '',
            after: '奔驰'
          },
          {
            field: '授权有效期',
            before: '',
            after: '2026-06-30'
          },
          {
            field: '授权书文件',
            before: '',
            after: 'image.png'
          }
        ]
      }
    ],
    createTime: '2026-06-24 15:44:13',
    updateTime: '2026-06-25 15:23:48'
  },
  {
    id: 'brand-auth-mqovpr0a7e0b',
    brandCode: 'BA0002',
    customerCode: 'CN0000438',
    brandName: 'ADAD',
    expireDate: '2026-07-09',
    authorizedProducts: [
      '202662433'
    ],
    authFiles: [
      {
        fileName: '8c8cf1133cf24dc8ad35e18998e53d50.png',
        url: 'http://localhost:3847/mock_data/uploads/brand-auth-files/BA0002_1782112408890_9xla.png',
        uploadedAt: '2026-06-22 15:13:28'
      }
    ],
    operationLogs: [
      {
        id: 'brand-auth-log-mqrykwgupa6',
        time: '2026-06-24 18:56:59',
        operator: '演示用户',
        action: '编辑',
        changes: [
          {
            field: '授权有效期',
            before: '2026-06-30',
            after: '2026-07-09'
          }
        ]
      },
      {
        id: 'brand-auth-log-mqovpr0ay20',
        time: '2026-06-22 15:13:28',
        operator: '演示用户',
        action: '新增',
        changes: [
          {
            field: '客户编码',
            before: '',
            after: 'CN0000438'
          },
          {
            field: '品牌名称',
            before: '',
            after: 'ADAD'
          },
          {
            field: '授权有效期',
            before: '',
            after: '2026-06-30'
          },
          {
            field: '授权书文件',
            before: '',
            after: '8c8cf1133cf24dc8ad35e18998e53d50.png'
          },
          {
            field: '授权产品',
            before: '',
            after: '空'
          }
        ]
      }
    ],
    createTime: '2026-06-22 15:13:28',
    updateTime: '2026-06-25 15:23:48',
    remark: ''
  },
  {
    id: 'brand-auth-mqouox5q8n6x',
    brandCode: 'BA0001',
    customerCode: 'CN0000438',
    brandName: 'NIKE',
    expireDate: '2026-12-31',
    authorizedProducts: [
      'YD20260615773',
      'YD20260615650'
    ],
    authFiles: [
      {
        fileName: '8c8cf1133cf24dc8ad35e18998e53d50.png',
        url: 'http://localhost:3847/mock_data/uploads/brand-auth-files/BA0001_1782110690285_r605.png',
        uploadedAt: '2026-06-22 14:44:50'
      }
    ],
    operationLogs: [
      {
        id: 'brand-auth-log-mqt6agq9you',
        time: '2026-06-25 15:20:35',
        operator: '演示用户',
        action: '编辑',
        changes: [
          {
            field: '备注',
            before: '示例备注',
            after: ''
          }
        ]
      },
      {
        id: 'brand-auth-log-mqrx7r2cer2',
        time: '2026-06-24 18:18:46',
        operator: '演示用户',
        action: '编辑',
        changes: [
          {
            field: '授权有效期',
            before: '2026-10-09',
            after: '2026-12-31'
          },
          {
            field: '备注',
            before: '',
            after: '示例备注'
          }
        ]
      },
      {
        id: 'brand-auth-log-mqoup3l60nu',
        time: '2026-06-22 14:44:58',
        operator: '演示用户',
        action: '编辑',
        changes: [
          {
            field: '授权有效期',
            before: '2026-09-30',
            after: '2026-10-09'
          }
        ]
      },
      {
        id: 'brand-auth-log-mqouox5qy1r',
        time: '2026-06-22 14:44:50',
        operator: '演示用户',
        action: '新增',
        changes: [
          {
            field: '客户编码',
            before: '',
            after: 'CN0000438'
          },
          {
            field: '品牌名称',
            before: '',
            after: 'NIKE'
          },
          {
            field: '授权有效期',
            before: '',
            after: '2026-09-30'
          },
          {
            field: '授权书文件',
            before: '',
            after: '8c8cf1133cf24dc8ad35e18998e53d50.png'
          }
        ]
      }
    ],
    createTime: '2026-06-22 14:44:50',
    updateTime: '2026-06-25 15:23:48',
    remark: ''
  }
];
