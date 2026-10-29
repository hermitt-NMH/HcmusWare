import { getAdminOrders } from '../../lib/api'
import OrderManager from '../../features/orders/OrderManager'

// Admin xem và xử lý đơn của mọi shop (Giai đoạn 2: mỗi đơn thuộc một shop).
export default function AdminOrders() {
  return <OrderManager load={getAdminOrders} showShop />
}
