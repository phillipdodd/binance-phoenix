  interface Order {
    clientOrderId: string
    executedQty: string
    icebergQty?: string
    orderId: number
    origQty: string
    price: string
    side: OrderSide
    status: OrderStatus
    stopPrice?: string
    symbol: string
    timeInForce: TimeInForce
    transactTime: number
    type: OrderType
    fills?: OrderFill[]
}