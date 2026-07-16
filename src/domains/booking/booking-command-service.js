import { requireTenantContext } from "../../runtime/tenant-context.js";
import { commandError, commandOk } from "./booking-command-result.js";
import {
  assertExpectedVersion,
  sanitizeBookingEventMetadata,
  validateBookingStatusCommand,
  validateCustomerInfoCommand,
  validateMerchantCancellationCommand,
  validateMerchantNoteCommand
} from "./booking-command-validation.js";

function tenantIdFromContext(context = {}) {
  return requireTenantContext(context.tenantContext || { tenantId: context.tenantId, isResolved: Boolean(context.tenantId) }).tenantId;
}

function actor(context = {}) {
  return {
    actorType: context.authContext?.actor?.type || "merchant",
    actorId: context.authContext?.actor?.id || context.actorId || "merchant"
  };
}

export function createBookingCommandService({ bookingRepository, bookingEventRepository } = {}) {
  async function loadScopedBooking(tenantId, bookingId) {
    const booking = await bookingRepository.findOperationById(tenantId, bookingId);
    return booking || null;
  }

  return {
    async getScopedBooking(context, bookingId) {
      const tenantId = tenantIdFromContext(context);
      const booking = await loadScopedBooking(tenantId, bookingId);
      if (!booking) return commandError("BOOKING_NOT_FOUND");
      return commandOk({ booking });
    },

    async updateBookingStatus(context, command = {}) {
      const tenantId = tenantIdFromContext(context);
      const payload = validateBookingStatusCommand(command);
      if (payload.ok === false) return payload;
      const booking = await loadScopedBooking(tenantId, payload.bookingId);
      if (!booking) return commandError("BOOKING_NOT_FOUND");
      if (String(booking.status || "") !== payload.fromStatus) return commandError("BOOKING_CONFLICT");
      const versionError = assertExpectedVersion(booking.updated_at, payload.expectedUpdatedAt);
      if (versionError) return versionError;
      const updatedAt = new Date().toISOString();
      let updateResult;
      try {
        updateResult = await bookingRepository.updateStatus(tenantId, booking.id, {
          fromStatus: payload.fromStatus,
          toStatus: payload.toStatus,
          updatedAt,
          expectedUpdatedAt: payload.expectedUpdatedAt
        });
      } catch (error) {
        context.logger?.error?.("booking.status_update_failed", { code: "BOOKING_STATUS_UPDATE_FAILED" });
        return commandError("BOOKING_STATUS_UPDATE_FAILED");
      }
      if (Number(updateResult?.meta?.changes || 0) !== 1) return commandError("BOOKING_CONFLICT");
      const { actorType, actorId } = actor(context);
      await command.appendStatusEvent?.({
        tenantId,
        bookingId: booking.id,
        eventType: "status_changed",
        fromStatus: payload.fromStatus,
        toStatus: payload.toStatus,
        actorType,
        actorId,
        reason: payload.reason
      }).catch(() => null);
      return commandOk({ booking: await loadScopedBooking(tenantId, booking.id) });
    },

    async cancelMerchantBooking(context, command = {}) {
      const tenantId = tenantIdFromContext(context);
      const payload = validateMerchantCancellationCommand(command);
      if (payload.ok === false) return payload;
      const booking = await loadScopedBooking(tenantId, payload.bookingId);
      if (!booking) return commandError("BOOKING_NOT_FOUND");
      if (String(booking.status || "") !== payload.fromStatus) return commandError("BOOKING_CONFLICT");
      const versionError = assertExpectedVersion(booking.updated_at, payload.expectedUpdatedAt);
      if (versionError) return versionError;
      const updatedAt = new Date().toISOString();
      let updateResult;
      try {
        updateResult = await bookingRepository.cancelMerchantStatus(tenantId, booking.id, {
          fromStatus: payload.fromStatus,
          toStatus: payload.toStatus,
          reason: payload.reason,
          updatedAt,
          expectedUpdatedAt: payload.expectedUpdatedAt
        });
      } catch (error) {
        context.logger?.error?.("booking.cancellation_update_failed", { code: "BOOKING_STATUS_UPDATE_FAILED" });
        return commandError("BOOKING_STATUS_UPDATE_FAILED");
      }
      if (Number(updateResult?.meta?.changes || 0) !== 1) return commandError("BOOKING_CONFLICT");
      await command.rollbackCustomerPoints?.({ tenantId, bookingId: booking.id, customerId: booking.customer_id });
      const { actorType, actorId } = actor(context);
      await command.appendCancellationEvent?.({
        tenantId,
        bookingId: booking.id,
        eventType: "cancelled",
        fromStatus: payload.fromStatus,
        toStatus: payload.toStatus,
        actorType,
        actorId,
        reason: payload.reason
      }).catch(() => null);
      return commandOk({ booking: await loadScopedBooking(tenantId, booking.id) });
    },

    async updateMerchantNote(context, command = {}) {
      const tenantId = tenantIdFromContext(context);
      const payload = validateMerchantNoteCommand(command);
      if (payload.ok === false) return payload;
      const booking = await loadScopedBooking(tenantId, payload.bookingId);
      if (!booking) return commandError("BOOKING_NOT_FOUND");
      const versionError = assertExpectedVersion(booking.updated_at, payload.expectedUpdatedAt);
      if (versionError) return versionError;
      const updatedAt = new Date().toISOString();
      let updateResult;
      try {
        updateResult = await bookingRepository.updateMerchantNote(tenantId, booking.id, {
          note: payload.note,
          updatedAt,
          expectedUpdatedAt: payload.expectedUpdatedAt
        });
      } catch (error) {
        context.logger?.error?.("booking.note_update_failed", { code: "BOOKING_NOTE_UPDATE_FAILED" });
        return commandError("BOOKING_NOTE_UPDATE_FAILED");
      }
      if (Number(updateResult?.meta?.changes || 0) !== 1) return commandError("BOOKING_CONFLICT");
      const { actorType, actorId } = actor(context);
      await bookingEventRepository.append({
        tenantId,
        bookingId: booking.id,
        eventType: "merchant_note_updated",
        actorType,
        actorId
      }).catch(() => null);
      return commandOk({ booking: await loadScopedBooking(tenantId, booking.id) });
    },

    async updateBookingCustomer(context, command = {}) {
      const tenantId = tenantIdFromContext(context);
      const payload = validateCustomerInfoCommand(command);
      if (payload.ok === false) return payload;
      const booking = await loadScopedBooking(tenantId, payload.bookingId);
      if (!booking) return commandError("BOOKING_NOT_FOUND");
      const versionError = assertExpectedVersion(booking.updated_at, payload.expectedUpdatedAt);
      if (versionError) return versionError;
      const updatedAt = new Date().toISOString();
      let updateResult;
      try {
        updateResult = await bookingRepository.updateCustomerInfo(tenantId, booking.id, {
          customerName: payload.customerName,
          customerPhone: payload.customerPhone,
          updatedAt,
          expectedUpdatedAt: payload.expectedUpdatedAt
        });
      } catch (error) {
        context.logger?.error?.("booking.customer_update_failed", { code: "BOOKING_CUSTOMER_UPDATE_FAILED" });
        return commandError("BOOKING_CUSTOMER_UPDATE_FAILED");
      }
      if (Number(updateResult?.meta?.changes || 0) !== 1) return commandError("BOOKING_CONFLICT");
      const { actorType, actorId } = actor(context);
      await bookingEventRepository.append({
        tenantId,
        bookingId: booking.id,
        eventType: "customer_updated",
        actorType,
        actorId,
        metadata: sanitizeBookingEventMetadata({
          oldName: booking.customer_name,
          newName: payload.customerName,
          phoneChanged: String(booking.customer_phone || "") !== payload.customerPhone
        })
      }).catch(() => null);
      return commandOk({ booking: await loadScopedBooking(tenantId, booking.id) });
    },

    async listBookingEvents(context, bookingId) {
      const tenantId = tenantIdFromContext(context);
      const booking = await loadScopedBooking(tenantId, bookingId);
      if (!booking) return commandError("BOOKING_NOT_FOUND");
      try {
        const events = await bookingEventRepository.listByBookingId(tenantId, booking.id);
        return commandOk({ events });
      } catch (error) {
        context.logger?.error?.("booking.event_read_failed", { code: "BOOKING_EVENT_READ_FAILED" });
        return commandError("BOOKING_EVENT_READ_FAILED");
      }
    }
  };
}
