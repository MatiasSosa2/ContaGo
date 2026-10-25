export function whereInBusiness<T extends object>(businessId: string, where: T) {
  return { ...where, businessId }
}
