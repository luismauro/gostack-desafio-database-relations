import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IOrdersRepository from '../repositories/IOrdersRepository';

import Order from '../infra/typeorm/entities/Order';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer ID does not exist.');
    }

    const availableProducts = await this.productsRepository.findAllById(
      products,
    );

    if (availableProducts.length !== products.length) {
      throw new AppError('List contains products that do not exist.');
    }

    const productsList = products.map(product => {
      const productInStock = availableProducts.find(p => p.id === product.id);

      if (!productInStock) {
        throw new Error('Something went wrong in the product list.');
      }

      if (product.quantity > productInStock.quantity) {
        throw new AppError(
          `Product '${productInStock.name}' is not available in that amount.`,
        );
      }

      return {
        product_id: product.id,
        quantity: product.quantity,
        price: productInStock.price,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: productsList,
    });

    const updatedProductsInQuantity = availableProducts.map(productInStock => {
      const productInCart = products.find(p => p.id === productInStock.id);

      if (!productInCart) {
        throw new Error(
          'Something went wrong updating the quantities in stock.',
        );
      }

      return {
        id: productInStock.id,
        quantity: productInStock.quantity - productInCart.quantity,
      };
    });

    await this.productsRepository.updateQuantity(updatedProductsInQuantity);

    return order;
  }
}

export default CreateOrderService;
