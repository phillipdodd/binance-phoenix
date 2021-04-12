  interface ExecutionReport extends Message {
    symbol: string
    newClientOrderId: string
    originalClientOrderId: string
    side: OrderSide
    orderType: OrderType
    timeInForce: TimeInForce
    quantity: string
    price: string
    executionType: ExecutionType
    stopPrice: string
    icebergQuantity: string
    orderStatus: OrderStatus
    orderRejectReason: string
    orderId: number
    orderTime: number
    lastTradeQuantity: string
    totalTradeQuantity: string
    priceLastTrade: string
    commission: string
    commissionAsset: string
    tradeId: number
    isOrderWorking: boolean
    isBuyerMaker: boolean
    totalQuoteTradeQuantity: string
  }