'use client'

import { create } from 'zustand'
import type { Cart, CartItemWithProduct } from '@/types/shop'
import { shopApi } from '@/lib/api/shop'

interface CartState {
  // State
  cart: Cart | null
  isLoading: boolean
  error: string | null

  // Actions
  fetchCart: () => Promise<void>
  addItem: (productId: string, qty?: number) => Promise<{ success: boolean; error?: string }>
  removeItem: (productId: string) => Promise<{ success: boolean; error?: string }>
  clearCart: () => Promise<{ success: boolean; error?: string }>
  checkout: () => Promise<{ success: boolean; orderId?: string; error?: string }>
  reset: () => void
}

const initialState = {
  cart: null,
  isLoading: false,
  error: null,
}

export const useCartStore = create<CartState>()((set, get) => ({
  ...initialState,

  /**
   * Fetch cart from API
   */
  fetchCart: async () => {
    set({ isLoading: true, error: null })

    try {
      const result = await shopApi.getCart()

      if (result.success && result.data) {
        set({
          cart: result.data,
          isLoading: false,
        })
      } else {
        set({
          cart: null,
          isLoading: false,
          error: result.message || result.error || 'Failed to fetch cart',
        })
      }
    } catch (error) {
      set({
        cart: null,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },

  /**
   * Add item to cart
   */
  addItem: async (productId: string, qty = 1) => {
    set({ isLoading: true, error: null })

    try {
      const result = await shopApi.addToCart({ productId, qty })

      if (result.success) {
        // Refresh cart after adding
        await get().fetchCart()
        return { success: true }
      } else {
        set({ isLoading: false, error: result.message })
        return { success: false, error: result.message }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      set({ isLoading: false, error: errorMsg })
      return { success: false, error: errorMsg }
    }
  },

  /**
   * Remove item from cart
   */
  removeItem: async (productId: string) => {
    set({ isLoading: true, error: null })

    try {
      const result = await shopApi.removeFromCart({ productId })

      if (result.success) {
        // Refresh cart after removing
        await get().fetchCart()
        return { success: true }
      } else {
        set({ isLoading: false, error: result.message })
        return { success: false, error: result.message }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      set({ isLoading: false, error: errorMsg })
      return { success: false, error: errorMsg }
    }
  },

  /**
   * Clear entire cart
   */
  clearCart: async () => {
    set({ isLoading: true, error: null })

    try {
      const result = await shopApi.clearCart()

      if (result.success) {
        set({
          cart: { items: [], subtotal: 0, itemCount: 0 },
          isLoading: false,
        })
        return { success: true }
      } else {
        set({ isLoading: false, error: result.message })
        return { success: false, error: result.message }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      set({ isLoading: false, error: errorMsg })
      return { success: false, error: errorMsg }
    }
  },

  /**
   * Checkout and create order
   */
  checkout: async () => {
    set({ isLoading: true, error: null })

    try {
      const result = await shopApi.checkout()

      if (result.success && result.data) {
        // Clear cart after successful checkout
        set({
          cart: { items: [], subtotal: 0, itemCount: 0 },
          isLoading: false,
        })
        return { success: true, orderId: result.data.id }
      } else {
        const errorMsg = result.message || result.error || 'Checkout failed'
        set({ isLoading: false, error: errorMsg })
        return { success: false, error: errorMsg }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      set({ isLoading: false, error: errorMsg })
      return { success: false, error: errorMsg }
    }
  },

  /**
   * Reset state
   */
  reset: () => {
    set(initialState)
  },
}))

// Selectors
export const selectCart = (state: CartState) => state.cart
export const selectCartItems = (state: CartState): CartItemWithProduct[] => state.cart?.items || []
export const selectCartItemCount = (state: CartState) => state.cart?.itemCount || 0
export const selectCartSubtotal = (state: CartState) => state.cart?.subtotal || 0
export const selectCartIsLoading = (state: CartState) => state.isLoading
export const selectCartError = (state: CartState) => state.error
