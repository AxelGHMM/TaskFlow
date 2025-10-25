// app.js

// Espera a que todo el HTML esté cargado
document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Obtenemos el contenedor donde irán las tareas
  const contenedorTareas = document.getElementById('contenedor-tareas');

  // 2. Usamos fetch() para pedir los datos al JSON
  fetch('tareas.json')
    .then(respuesta => {
      // Convertimos la respuesta en un objeto JSON
      return respuesta.json();
    })
    .then(tareas => {
      // 3. Una vez que tenemos las tareas, limpiamos el "Cargando..."
      contenedorTareas.innerHTML = ''; 

      // 4. Recorremos el arreglo de tareas y creamos el HTML
      tareas.forEach(tarea => {
        // Creamos los elementos HTML
        const tareaDiv = document.createElement('div');
        tareaDiv.className = 'tarea-item'; // Para que le des estilos con CSS

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = tarea.completada;

        const label = document.createElement('label');
        label.textContent = tarea.titulo;

        // Los armamos
        tareaDiv.appendChild(checkbox);
        tareaDiv.appendChild(label);

        // 5. Los agregamos al contenedor en el HTML
        contenedorTareas.appendChild(tareaDiv);
      });
    })
    .catch(error => {
      // Por si algo sale mal (ej. el archivo tareas.json no existe)
      console.error('Error al cargar las tareas:', error);
      contenedorTareas.innerHTML = '<p>Error: No se pudieron cargar las tareas.</p>';
    });
});