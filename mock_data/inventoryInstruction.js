/**
 * 指令盘点模拟数据：WH 下发 SKU 需求，海外仓按库存快照生成库位任务。
 */
var MOCK_INVENTORY_INSTRUCTION_LIST = [
  {
    id: 'ii-1786428878462',
    recordType: 'group',
    groupNo: 'IP20260811003',
    instructionNo: 'IP20260811003',
    customerCode: 'CN0000438',
    inventoryReason: '循环盘点',
    initiatedAt: '2026-08-11 14:13:55',
    groupStatus: '盘点中',
    status: '盘点中',
    creator: '中台操作员',
    createdAt: '2026-08-11 14:13:55',
    completedAt: '',
    remark: '',
    childInstructionIds: [
      'ii-1786428878462-w0',
      'ii-1786428878462-w1',
      'ii-1786428878462-w2'
    ],
    operationLogs: [
      {
        time: '2026-08-11 14:14:38',
        operator: '中台操作员',
        action: '创建指令盘点组单，客户：CN0000438，原因：循环盘点，下发 美西仓（LA）、美东仓（NY）、欧洲仓（DE）'
      }
    ]
  },
  {
    id: 'ii-1786428878462-w0',
    recordType: 'instruction',
    groupId: 'ii-1786428878462',
    groupNo: 'IP20260811003',
    instructionNo: 'IP20260811003-LA',
    customerCode: 'CN0000438',
    inventoryReason: '循环盘点',
    initiatedAt: '2026-08-11 14:13:55',
    status: '待盘点',
    creator: '中台操作员',
    createdAt: '2026-08-11 14:13:55',
    completedAt: '',
    remark: '',
    requestedSkus: [
      {
        skuCode: 'YD20260626167',
        productName: 'XXXXX2'
      },
      {
        skuCode: 'YD20260626286',
        productName: 'XXXXX2'
      },
      {
        skuCode: 'YD20260625704',
        productName: 'XXXXXX1112222'
      }
    ],
    warehouseTasks: [
      {
        taskId: 'ii-1786428878462-w0-task',
        warehouseCode: 'US-LA',
        warehouseName: '美西仓（LA）',
        requestedSkus: [
          {
            skuCode: 'YD20260626167',
            productName: 'XXXXX2'
          },
          {
            skuCode: 'YD20260626286',
            productName: 'XXXXX2'
          },
          {
            skuCode: 'YD20260625704',
            productName: 'XXXXXX1112222'
          }
        ],
        status: '待盘点',
        noStockSkus: [],
        items: [
          {
            lineId: 'ii-1786428878462-w0-task-YD20260626167-0',
            skuCode: 'YD20260626167',
            productName: 'XXXXX2',
            locationCode: 'A01-01-0101',
            expectedQty: 2,
            countedQty: '',
            differenceQty: '',
            lineStatus: '待认领',
            claimedBy: '',
            claimedAt: '',
            countedBy: '',
            countedAt: ''
          },
          {
            lineId: 'ii-1786428878462-w0-task-YD20260626167-1',
            skuCode: 'YD20260626167',
            productName: 'XXXXX2',
            locationCode: 'A01-01-0102',
            expectedQty: 6,
            countedQty: '',
            differenceQty: '',
            lineStatus: '待认领',
            claimedBy: '',
            claimedAt: '',
            countedBy: '',
            countedAt: ''
          },
          {
            lineId: 'ii-1786428878462-w0-task-YD20260626286-0',
            skuCode: 'YD20260626286',
            productName: 'XXXXX2',
            locationCode: 'A02-02-0101',
            expectedQty: 4,
            countedQty: '',
            differenceQty: '',
            lineStatus: '盘点中',
            claimedBy: 'PDA操作员',
            claimedAt: '2026-08-11 16:03:14',
            countedBy: '',
            countedAt: ''
          },
          {
            lineId: 'ii-1786428878462-w0-task-YD20260625704-0',
            skuCode: 'YD20260625704',
            productName: 'XXXXXX1112222',
            locationCode: 'B01-01-0101',
            expectedQty: 11,
            countedQty: 1,
            differenceQty: -10,
            lineStatus: '已盘',
            claimedBy: 'PDA操作员',
            claimedAt: '2026-08-11 09:42:32',
            countedBy: 'PDA操作员',
            countedAt: '2026-08-11 09:43:17'
          },
          {
            lineId: 'ii-1786428878462-w0-task-YD20260625704-1',
            skuCode: 'YD20260625704',
            productName: 'XXXXXX1112222',
            locationCode: 'B01-01-0102',
            expectedQty: 3,
            countedQty: '',
            differenceQty: '',
            lineStatus: '待认领',
            claimedBy: '',
            claimedAt: '',
            countedBy: '',
            countedAt: ''
          }
        ],
        autoCompletedSkus: []
      }
    ],
    operationLogs: [
      {
        time: '2026-08-11 14:14:38',
        operator: '中台操作员',
        action: '由组单 IP20260811003 拆分生成，向 美西仓（LA） 下发指令盘点'
      },
      {
        time: '2026-08-11 08:38:49',
        operator: 'PDA操作员',
        action: '认领美西仓（LA）料号 YD20260626286 的全部待盘库位'
      },
      {
        time: '2026-08-11 08:42:28',
        operator: 'PDA操作员',
        action: '放弃认领美西仓（LA）料号 YD20260626286'
      },
      {
        time: '2026-08-11 09:05:24',
        operator: 'PDA操作员',
        action: '认领美西仓（LA）料号 YD20260626286 的全部待盘库位'
      },
      {
        time: '2026-08-11 09:42:32',
        operator: 'PDA操作员',
        action: '认领美西仓（LA）料号 YD20260625704 的全部待盘库位'
      },
      {
        time: '2026-08-11 09:43:17',
        operator: 'PDA操作员',
        action: '完成美西仓（LA）库位 B01-01-0101盘点，实盘 1'
      },
      {
        time: '2026-08-11 09:46:32',
        operator: 'PDA操作员',
        action: '认领美西仓（LA）料号 YD20260625704 的全部待盘库位'
      },
      {
        time: '2026-08-11 09:46:34',
        operator: 'PDA操作员',
        action: '放弃认领美西仓（LA）料号 YD20260625704'
      },
      {
        time: '2026-08-11 10:00:51',
        operator: 'PDA操作员',
        action: '放弃认领美西仓（LA）料号 YD20260626286'
      },
      {
        time: '2026-08-11 10:01:56',
        operator: 'PDA操作员',
        action: '认领美西仓（LA）料号 YD20260626286 的全部待盘库位'
      },
      {
        time: '2026-08-11 10:02:03',
        operator: 'PDA操作员',
        action: '放弃认领美西仓（LA）料号 YD20260626286'
      },
      {
        time: '2026-08-11 10:02:05',
        operator: 'PDA操作员',
        action: '认领美西仓（LA）料号 YD20260626286 的全部待盘库位'
      },
      {
        time: '2026-08-11 10:02:07',
        operator: 'PDA操作员',
        action: '放弃认领美西仓（LA）料号 YD20260626286'
      },
      {
        time: '2026-08-11 10:02:08',
        operator: 'PDA操作员',
        action: '认领美西仓（LA）料号 YD20260625704 的全部待盘库位'
      },
      {
        time: '2026-08-11 10:02:34',
        operator: 'PDA操作员',
        action: '放弃认领美西仓（LA）料号 YD20260625704'
      },
      {
        time: '2026-08-11 16:03:14',
        operator: 'PDA操作员',
        action: '认领美西仓（LA）料号 YD20260626286 的全部待盘库位'
      }
    ]
  },
  {
    id: 'ii-1786428878462-w1',
    recordType: 'instruction',
    groupId: 'ii-1786428878462',
    groupNo: 'IP20260811003',
    instructionNo: 'IP20260811003-NY',
    customerCode: 'CN0000438',
    inventoryReason: '循环盘点',
    initiatedAt: '2026-08-11 14:13:55',
    status: '已完成',
    creator: '中台操作员',
    createdAt: '2026-08-11 14:13:55',
    completedAt: '2026-08-11 14:13:55',
    remark: '',
    requestedSkus: [
      {
        skuCode: 'YD20260626167',
        productName: 'XXXXX2'
      },
      {
        skuCode: 'YD20260626286',
        productName: 'XXXXX2'
      }
    ],
    warehouseTasks: [
      {
        taskId: 'ii-1786428878462-w1-task',
        warehouseCode: 'US-NY',
        warehouseName: '美东仓（NY）',
        requestedSkus: [
          {
            skuCode: 'YD20260626167',
            productName: 'XXXXX2'
          },
          {
            skuCode: 'YD20260626286',
            productName: 'XXXXX2'
          }
        ],
        status: '已完成',
        noStockSkus: [
          'YD20260626167',
          'YD20260626286'
        ],
        items: [],
        autoCompletedSkus: [
          {
            skuCode: 'YD20260626167',
            completedAt: '2026-08-11 14:13:55',
            remark: '无库存自动完结'
          },
          {
            skuCode: 'YD20260626286',
            completedAt: '2026-08-11 14:13:55',
            remark: '无库存自动完结'
          }
        ]
      }
    ],
    operationLogs: [
      {
        time: '2026-08-11 14:14:38',
        operator: '中台操作员',
        action: '由组单 IP20260811003 拆分生成，向 美东仓（NY） 下发指令盘点'
      },
      {
        time: '2026-08-11 14:13:55',
        operator: '系统',
        action: '全部有效库位盘点完成，子单自动完成'
      }
    ]
  },
  {
    id: 'ii-1786428878462-w2',
    recordType: 'instruction',
    groupId: 'ii-1786428878462',
    groupNo: 'IP20260811003',
    instructionNo: 'IP20260811003-DE',
    customerCode: 'CN0000438',
    inventoryReason: '循环盘点',
    initiatedAt: '2026-08-11 14:13:55',
    status: '已完成',
    creator: '中台操作员',
    createdAt: '2026-08-11 14:13:55',
    completedAt: '2026-08-11 14:13:55',
    remark: '',
    requestedSkus: [
      {
        skuCode: 'YD20260626167',
        productName: 'XXXXX2'
      },
      {
        skuCode: 'YD20260626286',
        productName: 'XXXXX2'
      }
    ],
    warehouseTasks: [
      {
        taskId: 'ii-1786428878462-w2-task',
        warehouseCode: 'EU-DE',
        warehouseName: '欧洲仓（DE）',
        requestedSkus: [
          {
            skuCode: 'YD20260626167',
            productName: 'XXXXX2'
          },
          {
            skuCode: 'YD20260626286',
            productName: 'XXXXX2'
          }
        ],
        status: '已完成',
        noStockSkus: [
          'YD20260626167',
          'YD20260626286'
        ],
        items: [],
        autoCompletedSkus: [
          {
            skuCode: 'YD20260626167',
            completedAt: '2026-08-11 14:13:55',
            remark: '无库存自动完结'
          },
          {
            skuCode: 'YD20260626286',
            completedAt: '2026-08-11 14:13:55',
            remark: '无库存自动完结'
          }
        ]
      }
    ],
    operationLogs: [
      {
        time: '2026-08-11 14:14:38',
        operator: '中台操作员',
        action: '由组单 IP20260811003 拆分生成，向 欧洲仓（DE） 下发指令盘点'
      },
      {
        time: '2026-08-11 14:13:55',
        operator: '系统',
        action: '全部有效库位盘点完成，子单自动完成'
      }
    ]
  },
  {
    id: 'ii-1786418744114',
    instructionNo: 'IP20260811002',
    customerCode: 'CN0000438',
    inventoryReason: '库存异常',
    initiatedAt: '2026-08-11 11:23:56',
    status: '已完成',
    priority: '紧急',
    deadlineAt: '2026-08-11 11:23:56',
    creator: '中台操作员',
    createdAt: '2026-08-11 11:23:56',
    completedAt: '2026-08-11 11:23:56',
    remark: '我是你爸爸',
    requestedSkus: [
      {
        skuCode: 'YD20260625315',
        productName: '21312312'
      },
      {
        skuCode: 'YD20260624472',
        productName: '2312123'
      }
    ],
    warehouseTasks: [
      {
        taskId: 'ii-1786418744114-w0',
        warehouseCode: 'US-LA',
        warehouseName: '美西仓（LA）',
        status: '已完成',
        noStockSkus: [
          'YD20260625315',
          'YD20260624472'
        ],
        items: [],
        autoCompletedSkus: [
          {
            skuCode: 'YD20260625315',
            completedAt: '2026-08-11 11:23:56',
            remark: '无库存自动完结'
          },
          {
            skuCode: 'YD20260624472',
            completedAt: '2026-08-11 11:23:56',
            remark: '无库存自动完结'
          }
        ]
      },
      {
        taskId: 'ii-1786418744114-w1',
        warehouseCode: 'US-NY',
        warehouseName: '美东仓（NY）',
        status: '已完成',
        noStockSkus: [
          'YD20260625315',
          'YD20260624472'
        ],
        items: [],
        autoCompletedSkus: [
          {
            skuCode: 'YD20260625315',
            completedAt: '2026-08-11 11:23:56',
            remark: '无库存自动完结'
          },
          {
            skuCode: 'YD20260624472',
            completedAt: '2026-08-11 11:23:56',
            remark: '无库存自动完结'
          }
        ]
      },
      {
        taskId: 'ii-1786418744114-w2',
        warehouseCode: 'EU-DE',
        warehouseName: '欧洲仓（DE）',
        status: '已完成',
        noStockSkus: [
          'YD20260625315',
          'YD20260624472'
        ],
        items: [],
        autoCompletedSkus: [
          {
            skuCode: 'YD20260625315',
            completedAt: '2026-08-11 11:23:56',
            remark: '无库存自动完结'
          },
          {
            skuCode: 'YD20260624472',
            completedAt: '2026-08-11 11:23:56',
            remark: '无库存自动完结'
          }
        ]
      }
    ],
    operationLogs: [
      {
        time: '2026-08-11 11:25:44',
        operator: '中台操作员',
        action: '创建指令盘点单，客户：CN0000438，原因：库存异常，下发 美西仓（LA）、美东仓（NY）、欧洲仓（DE）'
      },
      {
        time: '2026-08-11 11:23:56',
        operator: '系统',
        action: '全部有效库位盘点完成，子单自动完成'
      }
    ]
  },
  {
    id: 'ii-001',
    instructionNo: 'IP20260810001',
    status: '待盘点',
    priority: '紧急',
    customerCode: 'CN0000438',
    inventoryReason: '循环盘点',
    initiatedAt: '2026-08-10 08:30:00',
    deadlineAt: '2026-08-12 18:00',
    creator: '中台操作员',
    createdAt: '2026-08-10 08:30:00',
    completedAt: '',
    remark: '紧急循环盘点，需优先处理',
    requestedSkus: [
      {
        skuCode: 'SKU-10001',
        productName: '黑色收纳箱'
      },
      {
        skuCode: 'SKU-10002',
        productName: '白色收纳篮'
      }
    ],
    warehouseTasks: [
      {
        taskId: 'ii-001-w1',
        warehouseCode: 'US-LA',
        warehouseName: '美西仓（LA）',
        status: '待盘点',
        noStockSkus: [],
        items: [
          {
            lineId: 'ii-001-w1-1',
            skuCode: 'SKU-10001',
            productName: '黑色收纳箱',
            locationCode: 'A-01-01',
            expectedQty: 24,
            countedQty: '',
            differenceQty: '',
            lineStatus: '待认领',
            claimedBy: '',
            claimedAt: '',
            countedBy: '',
            countedAt: ''
          },
          {
            lineId: 'ii-001-w1-2',
            skuCode: 'SKU-10001',
            productName: '黑色收纳箱',
            locationCode: 'A-01-02',
            expectedQty: 12,
            countedQty: '',
            differenceQty: '',
            lineStatus: '待认领',
            claimedBy: '',
            claimedAt: '',
            countedBy: '',
            countedAt: ''
          },
          {
            lineId: 'ii-001-w1-3',
            skuCode: 'SKU-10002',
            productName: '白色收纳篮',
            locationCode: 'B-02-01',
            expectedQty: 18,
            countedQty: '',
            differenceQty: '',
            lineStatus: '待认领',
            claimedBy: '',
            claimedAt: '',
            countedBy: '',
            countedAt: ''
          }
        ],
        autoCompletedSkus: []
      },
      {
        taskId: 'ii-001-w2',
        warehouseCode: 'US-NY',
        warehouseName: '美东仓（NY）',
        status: '待盘点',
        noStockSkus: [],
        items: [
          {
            lineId: 'ii-001-w2-1',
            skuCode: 'SKU-10001',
            productName: '黑色收纳箱',
            locationCode: 'C-01-01',
            expectedQty: 9,
            countedQty: '',
            differenceQty: '',
            lineStatus: '待认领',
            claimedBy: '',
            claimedAt: '',
            countedBy: '',
            countedAt: ''
          },
          {
            lineId: 'ii-001-w2-2',
            skuCode: 'SKU-10002',
            productName: '白色收纳篮',
            locationCode: 'C-01-02',
            expectedQty: 16,
            countedQty: '',
            differenceQty: '',
            lineStatus: '待认领',
            claimedBy: '',
            claimedAt: '',
            countedBy: '',
            countedAt: ''
          }
        ],
        autoCompletedSkus: []
      }
    ],
    operationLogs: [
      {
        time: '2026-08-10 08:30:00',
        operator: '中台操作员',
        action: '创建指令盘点单，下发美西仓（LA）、美东仓（NY）'
      },
      {
        time: '2026-08-10 09:10:00',
        operator: 'PDA操作员',
        action: '认领美西仓（LA）库位 A-01-01（SKU-10001）'
      },
      {
        time: '2026-08-11 02:48:27',
        operator: '验证用户',
        action: '认领美西仓（LA）库位 A-01-02（SKU-10001）'
      },
      {
        time: '2026-08-11 02:48:41',
        operator: '验证用户',
        action: '放弃认领美西仓（LA）库位 A-01-02（SKU-10001）'
      },
      {
        time: '2026-08-11 10:17:58',
        operator: 'PDA操作员',
        action: '放弃认领美西仓（LA）料号 SKU-10001'
      }
    ]
  }
];
