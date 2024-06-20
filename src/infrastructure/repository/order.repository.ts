import { where } from "sequelize";
import Order from "../../domain/entity/order";
import OrderRepositoryInterface from "../../domain/repository/order-repository.interface";
import OrderItemModel from "../db/sequelize/model/order-item.model";
import OrderModel from "../db/sequelize/model/order.model";
import OrderItem from "../../domain/entity/order_item";

export default class OrderRepository implements OrderRepositoryInterface {

  async create(entity: Order): Promise<void> {
    await OrderModel.create(
      {
        id: entity.id,
        customer_id: entity.customerId,
        total: entity.total(),
        items: entity.items.map((item) => ({
          id: item.id,
          name: item.name,
          price: item.price,
          product_id: item.productId,
          quantity: item.quantity,
        })),
      },
      {
        include: [{ model: OrderItemModel }],
      }
    );
  }

  async update(entity: Order): Promise<void> {
    const orderModel = await this.find(entity.id);
    const idsOrderItems = orderModel.items.map(item => item.id).map(String);
    const newOrderItems = entity.items.filter(item => !idsOrderItems.includes(item.id));
    const existsOrderItems = entity.items.filter(item => idsOrderItems.includes(item.id));
    for await (const item of newOrderItems) {
      OrderItemModel.create({
        id: item.id,
        name: item.name,
        price: item.price,
        product_id: item.productId,
        quantity: item.quantity,
        order_id: entity.id,
      });
    }
    for await (const item of existsOrderItems) {
      OrderItemModel.update({
        name: item.name,
        price: item.price,
        product_id: item.productId,
        quantity: item.quantity,
        order_id: entity.id,
      },
      {
        where: {
          id: item.id,
        }
      });
    }
    
    await OrderModel.update({
      customer_id: entity.customerId,
      total: entity.total(),
    }, { where: { id: entity.id }});
  }

  async find(id: string): Promise<Order> {
    const orderModel = await OrderModel.findOne({
     where: {
      id,
     },
     include: OrderItemModel
    });

    const items = this.mapperOrderItems(orderModel.items);
    return new Order(orderModel.id, orderModel.customer_id, items);
  }

  async findAll(): Promise<Order[]> {
    const orderModels = await OrderModel.findAll({ include: OrderItemModel });
    return orderModels.map(order => new Order(order.id, order.customer_id, this.mapperOrderItems(order.items)));
  }

  private mapperOrderItems(orderItems: OrderItemModel[]): OrderItem[] {
    return orderItems.map((item) => new OrderItem(item.id, item.name, item.price, item.product_id, item.quantity));
  }
}
