import mongoose, { Schema } from 'mongoose';
import { IMenu } from '@/lib/types';

const menuSchema = new Schema<IMenu>(
  {
    name: {
      type: String,
      required: true,
    },
    description: String,
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      enum: ['Veg', 'Non-Veg'],
      required: true,
    },
    section: {
      type: String,
      default: 'Mains',
      trim: true,
    },
    sectionIcon: {
      type: String,
      trim: true,
      default: '',
    },
    imageURL: String,
    inStock: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

const existingMenuModel = mongoose.models.Menu as mongoose.Model<IMenu> | undefined;

if (
  existingMenuModel &&
  (!existingMenuModel.schema.path('section') || !existingMenuModel.schema.path('sectionIcon'))
) {
  delete mongoose.models.Menu;
}

const Menu =
  (mongoose.models.Menu as mongoose.Model<IMenu> | undefined) ||
  mongoose.model<IMenu>('Menu', menuSchema);

export default Menu;
