import mongoose from 'mongoose';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { connectToDatabase } from '@/lib/db/connection';
import { authenticateToken, requireAdmin } from '@/lib/middleware/auth';
import { ApiResponse } from '@/lib/types';
import Menu from '@/lib/models/Menu';

const updateMenuSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  price: z.number().min(0).optional(),
  category: z.enum(['Veg', 'Non-Veg']).optional(),
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  const adminCheck = requireAdmin(auth.payload);
  if (!adminCheck.isAdmin) {
    return adminCheck.response!;
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const updateData = updateMenuSchema.parse(body);
    const normalizedUpdateData = {
      ...updateData,
      ...(updateData.section !== undefined ? { section: updateData.section.trim() || 'Mains' } : {}),
      ...(updateData.sectionIcon !== undefined ? { sectionIcon: updateData.sectionIcon.trim() } : {}),
      updatedAt: new Date(),
    };

    await connectToDatabase();

    const item = await Menu.findByIdAndUpdate(
      new mongoose.Types.ObjectId(id),
      { $set: normalizedUpdateData },
      { new: true, runValidators: true }
    );

    if (!item) {
      const response: ApiResponse = {
        success: false,
        error: 'Menu item not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Menu item updated successfully',
      data: serializeMenuItem(item),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const response: ApiResponse = {
        success: false,
        error: 'Invalid request format',
      };
      return NextResponse.json(response, { status: 400 });
    }

    console.error('Update menu error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to update menu item',
    };
    return NextResponse.json(response, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = authenticateToken(request);
  if (!auth.valid || !auth.payload) {
    return auth.response!;
  }

  const adminCheck = requireAdmin(auth.payload);
  if (!adminCheck.isAdmin) {
    return adminCheck.response!;
  }

  try {
    const { id } = await params;
    await connectToDatabase();

    const item = await Menu.findByIdAndDelete(id);

    if (!item) {
      const response: ApiResponse = {
        success: false,
        error: 'Menu item not found',
      };
      return NextResponse.json(response, { status: 404 });
    }

    const response: ApiResponse = {
      success: true,
      message: 'Menu item deleted successfully',
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error('Delete menu error:', error);
    const response: ApiResponse = {
      success: false,
      error: 'Failed to delete menu item',
    };
    return NextResponse.json(response, { status: 500 });
  }
}
