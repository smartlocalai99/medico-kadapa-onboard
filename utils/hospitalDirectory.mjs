function sortHospitals(hospitals) {
  return [...hospitals].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

export function applyHospitalChange(hospitals, change) {
  if (change.eventType === 'DELETE') {
    return hospitals.filter((hospital) => hospital.id !== change.old?.id);
  }

  if (!change.new?.id) {
    return hospitals;
  }

  return sortHospitals([
    ...hospitals.filter((hospital) => hospital.id !== change.new.id),
    change.new,
  ]);
}
