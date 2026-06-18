export type reporteFacturacion = {
    fecha_factura: string;
    nro_factura: string;
    nro_orden: string;
    cliente: string;
    vendedor: string;
    zona: string;
    canal: string;
    prioridad: string;
    forma_pago: string | null;
    codigo_articulo: string;
    descripcion_articulo: string;
    marca: string;
    categoria: string;
    alicuota_iva: string;
    cantidad: number;
    precio_unitario: number;
    precio_sin_descuento: number;
    porcentaje_bonificacion: number;
    importe_bonificacion: number;
    total_linea: number;
}

export type notaCredito = {
    tipo: string;
    nro_documento: string;
    fecha: string;
    cliente: string;
    grupo_economico: string;
    vendedor: string;
    zona: string;
    codigo_articulo: string;
    descripcion_articulo: string;
    marca: string;
    categoria: string;
    cantidad: number;
    total_linea: number;
}

export type notaDebito = {
    tipo: string;
    nro_documento: string;
    fecha: string;
    cliente: string;
    grupo_economico: string;
    vendedor: string;
    zona: string;
    codigo_articulo: string;
    descripcion_articulo: string;
    marca: string;
    categoria: string;
    cantidad: number;
    total_linea: number;
}

export type ventaMarca = {
    marca: string;
    total2_importe: number;
}

export type estadoLineas = {
    fecha: string;
    lineas_entrantes: number;
    lineas_facturadas: number;
    lineas_pendientes_logistica: number;
    lineas_pendientes_ctasctes: number;
    lineas_no_facturadas: number;
    lineas_confirmadas: number;
    lineas_en_preparacion: number;
    lineas_en_empaquetado: number;
}

export type compraProducto = {
    codigo: string;
    descripcion: string;
    rubro: string;
    marca: string;
    stock: number;
    demanda: number;
    factura_venta: number;
    factura_compra: number;
    orden_compra: number;
};

export type productividadPorDia = {
    fecha: string;
    lineas_reposicion: number;
    lineas_preparadas: number;
    lineas_empaquetadas: number;
};

export type remitoDetalle = {
    numerodocumento: string;
    fecha: string;
    vendedor: string;
    cantidad_lineas: number;
    valor_sin_iva: number;
    peso_total: number;
    montodeclarado: number;
};

export type remitosResumen = {
    cantidad_remitos: number;
    cantidad_lineas: number;
    valor_declarado_sin_iva: number;
    peso_total: number;
};

export type remitosPorVendedor = {
    vendedor: string;
    cantidad_remitos: number;
    cantidad_lineas: number;
    valor_sin_iva: number;
    peso_total: number;
};

export type ContabiliumComprobante = {
    Id: number;
    IdComprobanteAsociado: number | null;
    IdUsuarioAdicional: number | null;
    IdCliente: number | null;
    RazonSocial: string;
    FechaAlta: string | null;
    FechaEmision: string | null;
    FechaServDesde: string | null;
    FechaServHasta: string | null;
    Numero: string;
    TipoFc: string;
    Modo: string;
    Cae: string | null;
    ImporteTotalNeto: string | number | null;
    ImporteTotalBruto: string | number | null;
    Saldo: string | number | null;
    PuntoVenta: number | null;
    Inventario: number | null;
    CondicionVenta: string | null;
    FechaVencimiento: string | null;
    Items: unknown[] | null;
    Tributos: unknown[] | null;
    Observaciones: string | null;
    Canal: string | null;
    TipoConcepto: number | null;
    Pagos: unknown[] | null;
    Descuento: unknown | null;
    Recargo: unknown | null;
    IDIntegracion: string | null;
    Origen: string | null;
    IDVentaIntegracion: string | null;
    IDCondicionVenta: number | null;
    IDTurno: number | null;
    IDMoneda: number | null;
    TipoDeCambio: number | null;
    PercepcionIIBB: unknown | null;
    IDJurisdiccion: number | null;
    RefExterna: string | null;
    fceMiPYME: boolean;
    IDVendedor: number | null;
    IDComprobanteDevolucion: number | null;
};

export type ContabiliumSearchResponse = {
    Items?: ContabiliumComprobante[] | null;
    TotalPages?: number | string | null;
    TotalItems?: number | string | null;
    PageSize?: number | string | null;
};

export type ContabiliumTokenResponse = {
    access_token?: string;
    token_type?: string;
    expires_in?: number | string;
};

export type ContabiliumAggregatedResponse = {
    totalImporteNeto: number;
    totalImporteBruto: number;
    byDate: Record<string, number>;
    byDateBruto: Record<string, number>;
    byDateCount: Record<string, number>;
    itemsCount: number;
    pagesFetched: number;
};
