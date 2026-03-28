import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken, requireAdmin } from '@/lib/middleware/auth';
import { ApiResponse } from '@/lib/types';
import Menu from '@/lib/models/Menu';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const createMenuSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  category: z.enum(['Veg', 'Non-Veg']),
  section: z.string().min(1).max(40).optional(),
  sectionIcon: z.string().max(1000000).optional(),
  imageURL: z.string().optional(),
  inStock: z.boolean().optional(),
});

const serializeMenuItem = (item: any) => ({
  _id: item._id.toString(),
  name: item.name,
  description: item.description,
  price: item.price,
  category: item.category,
  section: item.section || 'Mains',
  sectionIcon: item.sectionIcon || '',
  imageURL: item.imageURL,
  inStock: item.inStock,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const inStock = searchParams.get('inStock');
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    await connectToDatabase();

    let query: any = {};
    if (category) {
      query.category = category;
    }
    if (inStock !== null) {
      query.inStock = inStock === 'true';
    }

    const items = await Menu.find(query).limit(limit).sort({ createdAt: -1 }).lean();

    const response: ApiResponse = {
      success: true,
      data: {
        items: items.map(serializeMenuItem),
        total: items.length,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Get menu error:', error);

    if (error instanceof mongoose.Error.MongooseServerSelectionError) {
      const response: ApiResponse = {
        success: false,
        error:
          'Database unavailable. Check MongoDB Atlas Network Access, credentials, and cluster status.',
      };
      return NextResponse.json(response, { status: 503 });
    }

    const response: ApiResponse = {
      success: false,
      error: 'Failed to get menu items',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  const adminCheck = requireAdmin(auth.payload);
  if (!adminCheck.isAdmin) {
    return adminCheck.response!;
  }

  try {
    const body = await request.json();
    const menuData = createMenuSchema.parse(body);

    await connectToDatabase();

    const newItemData = {
      name: menuData.name,
      description: menuData.description || '',
      price: menuData.price,
      category: menuData.category,
      section: menuData.section?.trim() || 'Mains',
      sectionIcon: menuData.sectionIcon?.trim() || '',
      imageURL: menuData.imageURL,
      inStock: menuData.inStock ?? true,
    };

    const newItem = await Menu.create(newItemData);

    const response: ApiResponse = {
      success: true,
      message: 'Menu item created successfully',
      data: serializeMenuItem(newItem),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid request format',
      };
      return NextResponse.json(response, { status: 400 });
    }

    console.error('Create menu error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to create menu item',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
