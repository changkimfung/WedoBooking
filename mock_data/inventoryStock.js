/**
 * 海外仓库存模拟数据。
 * 以产品管理的 yundeNo（运德编号）为料号主键，供 WH 循环盘点建单和 US 执行盘点共同使用。
 */
var MOCK_INVENTORY_STOCK_SNAPSHOT = [
  { warehouseCode: 'US-LA', warehouseName: '美西仓（LA）', skuCode: 'YD20260626167', productName: 'XXXXX2', locationCode: 'A01-01-0101', expectedQty: 2 },
  { warehouseCode: 'US-LA', warehouseName: '美西仓（LA）', skuCode: 'YD20260626167', productName: 'XXXXX2', locationCode: 'A01-01-0102', expectedQty: 6 },
  { warehouseCode: 'US-LA', warehouseName: '美西仓（LA）', skuCode: 'YD20260626286', productName: 'XXXXX2', locationCode: 'A02-02-0101', expectedQty: 4 },
  { warehouseCode: 'US-LA', warehouseName: '美西仓（LA）', skuCode: 'YD20260626411', productName: 'XXXXX2', locationCode: 'A03-01-0101', expectedQty: 8 },
  { warehouseCode: 'US-LA', warehouseName: '美西仓（LA）', skuCode: 'YD20260625868', productName: 'XXXXXX1112222', locationCode: 'B01-01-0101', expectedQty: 15 },
  { warehouseCode: 'US-LA', warehouseName: '美西仓（LA）', skuCode: 'YD20260625868', productName: 'XXXXXX1112222', locationCode: 'B01-01-0102', expectedQty: 7 },
  { warehouseCode: 'US-LA', warehouseName: '美西仓（LA）', skuCode: 'YD20260625104', productName: 'XXXXXX1112222', locationCode: 'B02-02-0101', expectedQty: 9 },
  { warehouseCode: 'US-LA', warehouseName: '美西仓（LA）', skuCode: 'YD20260625704', productName: 'XXXXXX1112222', locationCode: 'B03-01-0101', expectedQty: 11 },
  { warehouseCode: 'US-LA', warehouseName: '美西仓（LA）', skuCode: 'YD20260625704', productName: 'XXXXXX1112222', locationCode: 'B03-01-0102', expectedQty: 3 },

  { warehouseCode: 'US-NY', warehouseName: '美东仓（NY）', skuCode: 'YD20260626167', productName: 'XXXXX2', locationCode: 'C01-01-0101', expectedQty: 12 },
  { warehouseCode: 'US-NY', warehouseName: '美东仓（NY）', skuCode: 'YD20260626300', productName: 'XXXXX2', locationCode: 'C02-01-0101', expectedQty: 5 },
  { warehouseCode: 'US-NY', warehouseName: '美东仓（NY）', skuCode: 'YD20260625276', productName: 'XXXXXX1112222', locationCode: 'C03-02-0101', expectedQty: 16 },
  { warehouseCode: 'US-NY', warehouseName: '美东仓（NY）', skuCode: 'YD20260625752', productName: 'XXXXXX1112222', locationCode: 'D01-01-0101', expectedQty: 10 },
  { warehouseCode: 'US-NY', warehouseName: '美东仓（NY）', skuCode: 'YD20260625415', productName: 'XXXXXX111', locationCode: 'D02-01-0101', expectedQty: 6 },
  { warehouseCode: 'US-NY', warehouseName: '美东仓（NY）', skuCode: 'YD20260625448', productName: 'XXXXXX111', locationCode: 'D03-01-0101', expectedQty: 14 },

  { warehouseCode: 'EU-DE', warehouseName: '欧洲仓（DE）', skuCode: 'YD20260625976', productName: 'XXXXXX111', locationCode: 'E01-01-0101', expectedQty: 8 },
  { warehouseCode: 'EU-DE', warehouseName: '欧洲仓（DE）', skuCode: 'YD20260625157', productName: 'XXXXXX111', locationCode: 'E02-01-0101', expectedQty: 13 },
  { warehouseCode: 'EU-DE', warehouseName: '欧洲仓（DE）', skuCode: 'YD20260625684', productName: 'XXXXXX111', locationCode: 'F01-01-0101', expectedQty: 4 },
  { warehouseCode: 'EU-DE', warehouseName: '欧洲仓（DE）', skuCode: 'YD20260625684', productName: 'XXXXXX111', locationCode: 'F01-01-0102', expectedQty: 6 },
  { warehouseCode: 'EU-DE', warehouseName: '欧洲仓（DE）', skuCode: 'YD20260625644', productName: 'XXXXXX111', locationCode: 'F02-02-0101', expectedQty: 9 }
];