import { getShopOrders } from '../../lib/api'
import OrderManager from '../../features/orders/OrderManager'

// Đơn hàng của shop (US-14.7). RLS chỉ trả đơn của shop mình; shop bị khóa vẫn xem được
// nhưng không đổi trạng thái (DB chặn qua can_manage_shop).
export default function SellerOrders({ shop, canEdit }) {
  return (
    <div className="space-y-3">
      {!canEdit && (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Shop đang bị khóa: bạn chỉ xem được đơn, chưa cập nhật trạng thái được.
        </p>
      )}
      <OrderManager load={() => getShopOrders(shop.id)} loadKey={shop.id} readOnly={!canEdit} />
    </div>
  )
}
