import { API_BASE_URL } from '../config/config.js';
import { showLoading, hideLoading, showError } from '../utils/ui.js';

document.addEventListener('DOMContentLoaded', cargarDashboard);

async function cargarDashboard() {
  try {
    showLoading();

    // Consultas paralelas independientes
    const [solicitudesRes, empresasRes, reportesRes, decisionesRes] = await Promise.all([
      fetch(`${API_BASE_URL}/solicitudes`),
      fetch(`${API_BASE_URL}/empresas`),
      fetch(`${API_BASE_URL}/reportesCumplimiento`),
      fetch(`${API_BASE_URL}/decisiones`)
    ]);

    if (!solicitudesRes.ok || !empresasRes.ok || !reportesRes.ok || !decisionesRes.ok) {
      throw new Error('Fallo al consultar las colecciones del dashboard.');
    }

    const [solicitudes, empresas, reportes, decisiones] = await Promise.all([
      solicitudesRes.json(),
      empresasRes.json(),
      reportesRes.json(),
      decisionesRes.json()
    ]);

    // Métricas de Solicitudes relacionando solicitudId
    const totalSolicitudes = solicitudes.length;
    const solicitudesAprobadas = solicitudes.filter(sol => {
      const dec = decisiones.find(d => d.solicitudId === sol.id);
      return (dec && (dec.decision === 'Aprobada' || dec.decision === 'Recomendada')) ||
             sol.decisionFinal === 'Recomendada' || 
             sol.estado === 'aprobada';
    }).length;

    const pctAprobadas = totalSolicitudes > 0 
      ? ((solicitudesAprobadas / totalSolicitudes) * 100).toFixed(1) 
      : '0.0';

    // Métricas de Cumplimiento relacionando empresaId
    const empresasConAlertaSet = new Set(
      reportes.filter(r => r.estado === 'con alerta').map(r => r.empresaId)
    );
    const empresasEnReglaSet = new Set(
      reportes.filter(r => r.estado === 'en regla').map(r => r.empresaId)
    );

    const cantidadConAlerta = empresasConAlertaSet.size;
    // Si una empresa tiene reportes en regla y ninguno con alerta, está totalmente en regla
    const cantidadEnRegla = Array.from(empresasEnReglaSet).filter(id => !empresasConAlertaSet.has(id)).length;

    // Actualización del DOM de forma directa
    const metricTotal = document.getElementById('metricTotalSolicitudes');
    const metricPct = document.getElementById('metricPctAprobadas');
    const metricRegla = document.getElementById('metricEmpresasRegla');
    const metricAlerta = document.getElementById('metricEmpresasAlerta');

    if (metricTotal) metricTotal.textContent = totalSolicitudes;
    if (metricPct) metricPct.textContent = `${pctAprobadas}%`;
    if (metricRegla) metricRegla.textContent = cantidadEnRegla;
    if (metricAlerta) metricAlerta.textContent = cantidadConAlerta;

    // Resumen consolidado PROCOMER
    const resumenElem = document.getElementById('resumenProcomer');
    if (resumenElem) {
      if (empresas.length === 0 && reportes.length === 0) {
        resumenElem.innerHTML = '<p class="empty-state">No hay suficientes datos registrados para consolidar el reporte PROCOMER.</p>';
        return;
      }

      const totalInversion = reportes.reduce((sum, r) => sum + (r.inversionEjecutada || 0), 0);
      const totalExportaciones = reportes.reduce((sum, r) => sum + (r.exportaciones || 0), 0);
      const zonasFrancasActivas = new Set(solicitudes.map(s => s.zonaFrancaId).filter(Boolean)).size;

      resumenElem.innerHTML = `
        <div class="procomer-card">
          <h3>Consolidado de Impacto Económico - PROCOMER</h3>
          <p><strong>Empresas Instaladas:</strong> ${empresas.length}</p>
          <p><strong>Zonas Francas involucradas (zonaFrancaId):</strong> ${zonasFrancasActivas}</p>
          <p><strong>Inversión Ejecutada Acumulada:</strong> $${totalInversion.toLocaleString()}</p>
          <p><strong>Exportaciones Totales Generadas:</strong> $${totalExportaciones.toLocaleString()}</p>
          <p><strong>Estatus del Ecosistema:</strong> ${cantidadConAlerta === 0 ? 'Sin alertas activas' : `${cantidadConAlerta} empresa(s) con requerimiento de atención`}</p>
        </div>
      `;
    }

  } catch (err) {
    console.error('[Dashboard - Carga Optimizada Error]:', err);
    showError('Error al consolidar las métricas generales del sistema.');
  } finally {
    hideLoading();
  }
}