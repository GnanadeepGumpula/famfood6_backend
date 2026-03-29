import mongoose, { Schema, Document } from 'mongoose';
import { IMenu } from '@/lib/types';

interface IMenuDocument extends IMenu, Document {}

const menuSchema = new Schema<IMenuDocument>(
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

const existingMenuModel = mongoose.models.Menu as mongoose.Model<IMenuDocument> | undefined;

if (
  existingMenuModel &&
  (!existingMenuModel.schema.path('section') || !existingMenuModel.schema.path('sectionIcon'))
) {
  delete mongoose.models.Menu;
}

const Menu =
  (mongoose.models.Menu as mongoose.Model<IMenuDocument> | undefined) ||
  mongoose.model<IMenuDocument>('Menu', menuSchema);

export default Menu;
